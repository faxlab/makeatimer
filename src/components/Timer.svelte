<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { decodeShare } from '../lib/share';
  import {
    remainingTime,
    pauseTimer,
    resumeTimer,
    validateTimer,
    displayMilliseconds,
  } from '../lib/timing';
  import type { TimerState } from '../lib/timing';
  import { unlockAudio, playSound } from '../lib/audio';
  import type { Sound } from '../lib/audio';
  import ZonePicker from './ZonePicker.svelte';
  import Actions from './Actions.svelte';
  let { event = false } = $props<{ event?: boolean }>();
  const defaults = untrack(() => ({
    mode: event ? 'until' : 'duration',
    hours: '0',
    minutes: '5',
    seconds: '0',
    time: '17:00',
    date: '',
    zone: 'UTC',
    choice: 'reject',
    label: event ? 'My event' : '',
    instant: '',
  }));
  const storageKey = untrack(() =>
    event ? 'makeatimer:event' : 'makeatimer:timer',
  );
  let inputs = $state({ ...defaults });
  let timer = $state<TimerState | null>(null);
  let now = $state(Date.now());
  let warning = $state('');
  let error = $state('');
  let sound = $state<Sound>('bell');
  let awake = $state(false);
  let wakeMessage = $state('');
  let full = $state(false);
  let element: HTMLElement;
  let lock: WakeLockSentinel | null = null;
  let zoneModule = $state<typeof import('../lib/zones')>();
  let ready = $state(false);
  let restored = $state(false);
  let remaining = $derived(timer ? remainingTime(timer, now) : 300000);
  let preview = $derived.by(() => {
    if (inputs.mode !== 'until' || !zoneModule)
      return { target: null, error: '' };
    try {
      if (inputs.instant) {
        const epoch = zoneModule.Temporal.Instant.from(
          inputs.instant,
        ).epochMilliseconds;
        if (epoch <= now)
          throw new Error(
            'This shared deadline has passed. Choose a new date and time.',
          );
        return {
          target: {
            epoch,
            label: 'Shared deadline',
            destination: zoneModule.formatInstant(epoch, inputs.zone),
            local: zoneModule.formatInstant(epoch, zoneModule.localZone()),
          },
          error: '',
        };
      }
      if (event && !inputs.date) throw new Error('Choose an event date.');
      return {
        target: zoneModule.untilTarget(
          inputs.time,
          inputs.zone,
          inputs.date,
          inputs.choice,
          now,
        ),
        error: '',
      };
    } catch (e) {
      return { target: null, error: (e as Error).message };
    }
  });
  let sharedValues = $derived({
    ...inputs,
    instant:
      inputs.mode === 'duration'
        ? ''
        : timer?.kind === 'deadline'
          ? new Date(timer.end).toISOString()
          : inputs.mode === 'until' && preview.target
            ? new Date(preview.target.epoch).toISOString()
            : inputs.instant,
  });
  $effect(() => {
    document.body.classList.toggle('timing-active', !!timer || full);
    document.body.classList.toggle(
      'tool-error',
      !!error || (!timer && inputs.mode === 'until' && !!preview.error),
    );
    return () => {
      document.body.classList.remove('timing-active', 'tool-error');
    };
  });
  function persist() {
    try {
      if (timer)
        sessionStorage.setItem(
          storageKey,
          JSON.stringify({ timer, inputs, sound, awake, href: location.href }),
        );
      else sessionStorage.removeItem(storageKey);
    } catch {
      warning = 'Tab storage is unavailable; refresh recovery is disabled.';
    }
  }
  function preference() {
    try {
      localStorage.setItem('makeatimer:sound', sound);
    } catch {
      /* optional */
    }
  }
  async function updateWake() {
    if (
      !awake ||
      timer?.status !== 'running' ||
      document.visibilityState !== 'visible'
    ) {
      if (lock) await lock.release().catch(() => {});
      lock = null;
      return;
    }
    if (!('wakeLock' in navigator)) {
      wakeMessage = 'Screen-awake mode is unavailable in this browser.';
      return;
    }
    try {
      lock ??= await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => {
        lock = null;
      });
      wakeMessage =
        'Screen-awake mode requested. The browser may still suspend this page.';
    } catch {
      wakeMessage =
        'The browser could not keep the screen awake. The timer still works.';
    }
  }
  function setActive() {
    document.body.classList.toggle('timing-active', !!timer || full);
    void updateWake();
  }
  function tick() {
    now = Date.now();
    if (timer?.status === 'running' && remainingTime(timer, now) <= 0) {
      timer = { ...timer, status: 'finished', remaining: 0 };
      playSound(sound);
      persist();
      setActive();
    }
  }
  function syncSharedInstant() {
    if (!inputs.instant || inputs.mode !== 'until' || !zoneModule) return;
    try {
      const z = zoneModule.Temporal.Instant.from(
        inputs.instant,
      ).toZonedDateTimeISO(inputs.zone);
      inputs.date = z.toPlainDate().toString();
      inputs.time = z.toPlainTime().toString({ smallestUnit: 'second' });
      inputs.mode = 'until';
    } catch {
      error = 'This shared deadline or time zone is invalid.';
    }
  }
  onMount(() => {
    let alive = true;
    let explicitShared = !!location.hash;
    const restoreLink = () => {
      const decoded = decodeShare(location.hash, defaults);
      inputs = { ...decoded.values } as typeof defaults;
      warning = decoded.warning;
      if (event) inputs.mode = 'until';
      else if (!['duration', 'until'].includes(inputs.mode)) {
        inputs = { ...defaults, zone: zoneModule?.localZone() || 'UTC' };
        warning =
          'This shared timer mode is not supported. Defaults were restored.';
      }
      timer = null;
      restored = false;
      error = '';
      syncSharedInstant();
      persist();
      setActive();
    };
    try {
      sound = (localStorage.getItem('makeatimer:sound') as Sound) || 'bell';
      if (!['bell', 'beep', 'silent'].includes(sound)) sound = 'bell';
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const data = JSON.parse(saved);
        const reload =
          (
            performance.getEntriesByType(
              'navigation',
            )[0] as PerformanceNavigationTiming
          )?.type === 'reload';
        if (!explicitShared || (reload && data.href === location.href)) {
          const t = validateTimer(data.timer);
          if (t) {
            timer = t;
            inputs = { ...defaults, ...data.inputs };
            awake = !!data.awake;
            restored = true;
            explicitShared = false;
          }
        }
      }
    } catch {
      warning = 'Saved timer could not be restored.';
    }
    import('../lib/zones')
      .then((m) => {
        if (!alive) return;
        zoneModule = m;
        if (explicitShared) restoreLink();
        else if (!timer) inputs.zone = m.localZone();
        ready = true;
        tick();
        setActive();
      })
      .catch(() => {
        warning = 'Time-zone support could not load. Refresh to try again.';
        ready = true;
      });
    window.addEventListener('hashchange', restoreLink);
    const ticker = setInterval(tick, 100);
    const visible = () => {
      tick();
      void updateWake();
    };
    document.addEventListener('visibilitychange', visible);
    const fullscreen = () => {
      if (!document.fullscreenElement) full = false;
    };
    document.addEventListener('fullscreenchange', fullscreen);
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') full = false;
    };
    window.addEventListener('keydown', escape);
    return () => {
      alive = false;
      clearInterval(ticker);
      window.removeEventListener('hashchange', restoreLink);
      document.removeEventListener('visibilitychange', visible);
      document.removeEventListener('fullscreenchange', fullscreen);
      window.removeEventListener('keydown', escape);
      document.body.classList.remove('timing-active');
      if (lock) void lock.release();
    };
  });
  async function start() {
    error = '';
    restored = false;
    try {
      await unlockAudio();
      now = Date.now();
      if (inputs.mode === 'duration') {
        if (
          ![inputs.hours, inputs.minutes, inputs.seconds].every((v) =>
            /^\d+$/.test(String(v)),
          )
        )
          throw new Error(
            'Use whole, nonnegative hours, minutes, and seconds.',
          );
        const [h, m, s] = [inputs.hours, inputs.minutes, inputs.seconds].map(
          Number,
        );
        if (h > 8760 || m > 59 || s > 59)
          throw new Error(
            'Minutes and seconds must be 0–59; hours must be 0–8,760.',
          );
        const total = (h * 3600 + m * 60 + s) * 1000;
        if (total <= 0) throw new Error('Enter a duration greater than zero.');
        timer = {
          kind: 'duration',
          total,
          remaining: total,
          end: now + total,
          status: 'running',
          zone: inputs.zone,
        };
      } else {
        if (!preview.target)
          throw new Error(preview.error || 'Check your deadline.');
        const total = preview.target.epoch - now;
        if (total <= 0 || total > 315360000000)
          throw new Error('Choose a future deadline within ten years.');
        timer = {
          kind: 'deadline',
          total,
          remaining: total,
          end: preview.target.epoch,
          status: 'running',
          zone: inputs.zone,
        };
        inputs.instant = new Date(timer.end).toISOString();
      }
      persist();
      setActive();
    } catch (e) {
      error = (e as Error).message;
    }
  }
  function togglePause() {
    if (!timer) return;
    now = Date.now();
    timer =
      timer.status === 'running'
        ? pauseTimer(timer, now)
        : resumeTimer(timer, now);
    persist();
    setActive();
  }
  function stop() {
    timer = null;
    inputs.instant = '';
    error = '';
    persist();
    setActive();
  }
  async function fullscreen() {
    full = !full;
    if (full) {
      try {
        await element.requestFullscreen();
      } catch {
        /* CSS fallback */
      }
    } else if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
    }
  }
  const edited = () => {
    inputs.instant = '';
    error = '';
  };
</script>

<section
  bind:this={element}
  class="calculator-card timer-card"
  class:fullscreen-fallback={full}
  aria-label={event ? 'Event countdown' : 'Timer'}
>
  {#if warning}<p class="notice" role="status">{warning}</p>{/if}
  {#if !timer}
    {#if !event}<div class="tabs" aria-label="Timer mode">
        <button
          class:chosen={inputs.mode === 'duration'}
          aria-pressed={inputs.mode === 'duration'}
          onclick={() => {
            inputs.mode = 'duration';
            error = '';
          }}>Duration</button
        ><button
          class:chosen={inputs.mode === 'until'}
          aria-pressed={inputs.mode === 'until'}
          onclick={() => {
            inputs.mode = 'until';
            error = '';
          }}>Until a time</button
        >
      </div>{/if}
    <form
      onsubmit={(e) => {
        e.preventDefault();
        void start();
      }}
    >
      {#if inputs.mode === 'duration'}
        <div class="duration-inputs">
          {#each [['hours', 'Hours'], ['minutes', 'Minutes'], ['seconds', 'Seconds']] as [key, label]}<div
              class="field"
            >
              <label for={key}>{label}</label><input
                id={key}
                type="number"
                min="0"
                max={key === 'hours' ? '8760' : '59'}
                step="1"
                value={inputs[key as 'hours' | 'minutes' | 'seconds']}
                oninput={(e) => {
                  inputs[key as 'hours' | 'minutes' | 'seconds'] =
                    e.currentTarget.value;
                }}
              />
            </div>{/each}
        </div>
        <div class="presets">
          <span class="sr-only">Quick durations</span
          >{#each [1, 5, 10, 15, 25, 60] as minutes}<button
              type="button"
              class:chosen={+inputs.hours * 60 + +inputs.minutes === minutes &&
                +inputs.seconds === 0}
              onclick={() => {
                inputs.hours = String(Math.floor(minutes / 60));
                inputs.minutes = String(minutes % 60);
                inputs.seconds = '0';
              }}>{minutes} min</button
            >{/each}
        </div>
      {:else}
        <div class="form-grid">
          {#if event}<div class="field wide">
              <label for="event-name">Event name</label><input
                id="event-name"
                bind:value={inputs.label}
                maxlength="100"
              />
            </div>{/if}
          <div class="field">
            <label for="until-time">Finish at</label><input
              id="until-time"
              type="time"
              step="1"
              bind:value={inputs.time}
              oninput={edited}
              required
            />
          </div>
          <ZonePicker
            id="until-zone"
            label="Time zone"
            bind:value={inputs.zone}
          />
          {#if event}<div class="field">
              <label for="event-date">Event date</label><input
                id="event-date"
                type="date"
                bind:value={inputs.date}
                oninput={edited}
                required
              />
            </div>{:else}<details class="wide">
              <summary
                >Choose a specific date <span class="muted">(optional)</span
                ></summary
              >
              <div class="field">
                <label for="until-date">Date in destination zone</label><input
                  id="until-date"
                  type="date"
                  bind:value={inputs.date}
                  oninput={edited}
                />
              </div>
            </details>{/if}
          <details class="wide">
            <summary>Daylight-saving options</summary>
            <div class="field">
              <label for="dst-choice">If the clock time occurs twice</label
              ><select
                id="dst-choice"
                bind:value={inputs.choice}
                onchange={edited}
                ><option value="reject">Ask me to choose</option><option
                  value="earlier">Earlier occurrence</option
                ><option value="later">Later occurrence</option></select
              ><small>Missing clock times are always rejected.</small>
            </div>
          </details>
        </div>
        {#if preview.target}<div class="deadline-preview">
            <strong
              >{preview.target.label} · {preview.target.destination}</strong
            >
            <p>Your local time: {preview.target.local}</p>
            {#if inputs.instant}<button
                type="button"
                class="quiet"
                onclick={edited}>Edit shared deadline</button
              >{/if}
          </div>{:else if ready && preview.error}<p class="error" role="alert">
            {preview.error}
          </p>{/if}
      {/if}
      {#if error}<p class="error" role="alert">{error}</p>{/if}
      <button
        type="submit"
        class="primary start-button"
        disabled={!ready || (inputs.mode === 'until' && !preview.target)}
        ><span aria-hidden="true">▶</span>
        {event ? 'Start countdown' : 'Start timer'}</button
      >
    </form>
  {:else}
    <p class="eyebrow">
      {inputs.label ||
        (timer.status === 'finished'
          ? 'Time is up'
          : timer.status === 'paused'
            ? 'Paused'
            : 'Time remaining')}
    </p>
    <div
      class="timer-display"
      aria-label={`${displayMilliseconds(remaining)} remaining`}
    >
      {displayMilliseconds(remaining)}
    </div>
    <progress
      value={timer.total - remaining}
      max={timer.total}
      aria-label="Timer progress"
    ></progress>
    <p class="finish-time">
      {timer.status === 'paused'
        ? 'Resume to set a new finishing time.'
        : `Finishes ${zoneModule?.formatInstant(timer.end, timer.zone) || new Date(timer.end).toLocaleString()}`}
    </p>
    <div class="running-controls">
      {#if timer.status !== 'finished' && timer.kind === 'duration'}<button
          class="primary"
          onclick={togglePause}
          >{timer.status === 'running' ? 'Pause' : 'Resume'}</button
        >{/if}<button class="secondary" onclick={stop}
        >{timer.status === 'finished' ? 'New timer' : 'Stop / edit'}</button
      ><button class="secondary" onclick={fullscreen}
        >{full ? 'Exit fullscreen' : 'Fullscreen'}</button
      >
    </div>
    {#if timer.status === 'finished'}<p class="notice" role="status">
        {restored
          ? 'Your deadline passed while this page was unavailable. Sound may need to be enabled again.'
          : 'Time is up.'}
      </p>{/if}
    {#if restored && timer.status === 'running'}<button
        class="quiet"
        onclick={async () => {
          await unlockAudio();
          restored = false;
        }}>Enable sound for restored timer</button
      >{/if}
  {/if}
  <div class="timer-settings">
    <div class="sound-setting">
      <label for="sound">Alarm sound</label><select
        id="sound"
        bind:value={sound}
        onchange={() => {
          preference();
          persist();
        }}
        ><option value="bell">Bell</option><option value="beep">Beep</option
        ><option value="silent">Silent</option></select
      ><button
        class="quiet"
        onclick={async () => {
          await unlockAudio();
          playSound(sound);
        }}>Test sound</button
      >
    </div>
    <label class="checkbox"
      ><input
        type="checkbox"
        bind:checked={awake}
        onchange={() => {
          persist();
          void updateWake();
        }}
      /> Keep screen awake</label
    >
  </div>
  {#if wakeMessage}<p class="status" role="status">{wakeMessage}</p>{/if}
  <p class="browser-note">
    Keep this tab available. Alarms may be delayed if the browser closes,
    sleeps, or suspends the page.
  </p>
  <Actions
    values={sharedValues}
    path={event ? '/countdown/' : '/'}
    text={timer
      ? `${inputs.label ? inputs.label + ': ' : ''}${displayMilliseconds(remaining)} remaining${timer.status !== 'paused' ? ` · ${new Date(timer.end).toISOString()}` : ' · paused'}`
      : inputs.mode === 'duration'
        ? `${inputs.hours}h ${inputs.minutes}m ${inputs.seconds}s`
        : preview.target
          ? `${inputs.label} ${preview.target.local}`
          : ''}
    disabled={!ready || (!timer && inputs.mode === 'until' && !preview.target)}
  />
</section>
