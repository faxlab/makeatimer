<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { intervalPosition, displayMilliseconds } from '../lib/timing';
  import { decodeShare } from '../lib/share';
  import { unlockAudio, playSound } from '../lib/audio';
  import type { Sound } from '../lib/audio';
  import Actions from './Actions.svelte';
  let { intervals = false } = $props<{ intervals?: boolean }>();
  const defaults = untrack((): Record<string, string> => {
    if (intervals) return { work: '30', rest: '10', rounds: '8' };
    return {};
  });
  let inputs = $state<Record<string, string>>({ ...defaults });
  let status = $state<'idle' | 'running' | 'paused' | 'finished'>('idle');
  let base = $state(0);
  let started = $state(0);
  let elapsed = $state(0);
  let laps = $state<{ split: number; total: number }[]>([]);
  let sound = $state<Sound>('bell');
  let error = $state('');
  let warning = $state('');
  let restored = $state(false);
  let full = $state(false);
  let ready = $state(false);
  let element: HTMLElement;
  const storageKey = untrack(() =>
    intervals ? 'makeatimer:interval' : 'makeatimer:stopwatch',
  );
  let valid = $derived(
    intervals
      ? /^\d+$/.test(inputs.work) &&
          +inputs.work > 0 &&
          +inputs.work <= 86400 &&
          /^\d+$/.test(inputs.rest) &&
          +inputs.rest >= 0 &&
          +inputs.rest <= 86400 &&
          /^\d+$/.test(inputs.rounds) &&
          +inputs.rounds > 0 &&
          +inputs.rounds <= 1000
      : true,
  );
  let total = $derived(
    intervals
      ? (+inputs.work * +inputs.rounds + +inputs.rest * (+inputs.rounds - 1)) *
          1000
      : 0,
  );
  let position = $derived(
    intervalPosition(
      elapsed,
      +inputs.work * 1000,
      +inputs.rest * 1000,
      +inputs.rounds,
    ),
  );
  $effect(() => {
    document.body.classList.toggle('timing-active', status !== 'idle' || full);
    document.body.classList.toggle('tool-error', !!error);
    return () => {
      document.body.classList.remove('timing-active', 'tool-error');
    };
  });
  function active() {
    document.body.classList.toggle('timing-active', status !== 'idle' || full);
  }
  function persist() {
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({
          inputs,
          status,
          base,
          started,
          laps,
          href: location.href,
        }),
      );
    } catch {
      warning = 'Tab storage is unavailable; refresh recovery is disabled.';
    }
  }
  function tick() {
    if (status !== 'running') return;
    const previous = intervals
      ? intervalPosition(
          elapsed,
          +inputs.work * 1000,
          +inputs.rest * 1000,
          +inputs.rounds,
        )
      : null;
    elapsed = Math.max(0, base + Date.now() - started);
    if (intervals) {
      if (elapsed >= total) {
        elapsed = total;
        base = total;
        status = 'finished';
        playSound(sound);
        persist();
        active();
      } else if (
        previous &&
        (position.phase !== previous.phase || position.round !== previous.round)
      )
        playSound(sound);
    }
  }
  onMount(() => {
    const restoreLink = () => {
      const decoded = decodeShare(location.hash, defaults);
      inputs = decoded.values;
      warning = decoded.warning;
      status = 'idle';
      base = 0;
      elapsed = 0;
      laps = [];
      persist();
      active();
    };
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
      const reload =
        (
          performance.getEntriesByType(
            'navigation',
          )[0] as PerformanceNavigationTiming
        )?.type === 'reload';
      if (location.hash && !(reload && saved?.href === location.href))
        restoreLink();
      else if (
        saved &&
        ['idle', 'running', 'paused', 'finished'].includes(saved.status) &&
        [saved.base, saved.started].every(
          (n: number) => Number.isFinite(n) && n >= 0 && n <= 8640000000000000,
        ) &&
        Array.isArray(saved.laps) &&
        saved.laps.length <= 1000 &&
        saved.laps.every(
          (l: { total: number; split: number }) =>
            Number.isFinite(l.total) &&
            Number.isFinite(l.split) &&
            l.total >= 0 &&
            l.split >= 0,
        )
      ) {
        inputs = { ...defaults, ...saved.inputs };
        if (valid) {
          status = saved.status;
          base = saved.base;
          started = saved.started;
          elapsed = base;
          laps = saved.laps;
          restored = status === 'running';
          tick();
          active();
        } else inputs = { ...defaults };
      }
    } catch {
      warning = 'Saved timing state could not be restored.';
    }
    ready = true;
    const ticker = setInterval(tick, 40);
    const visible = () => tick();
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') full = false;
    };
    const fullscreen = () => {
      if (!document.fullscreenElement) full = false;
    };
    window.addEventListener('hashchange', restoreLink);
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('keydown', escape);
    document.addEventListener('fullscreenchange', fullscreen);
    return () => {
      clearInterval(ticker);
      window.removeEventListener('hashchange', restoreLink);
      document.removeEventListener('visibilitychange', visible);
      window.removeEventListener('keydown', escape);
      document.removeEventListener('fullscreenchange', fullscreen);
      document.body.classList.remove('timing-active');
    };
  });
  async function start() {
    if (!valid) {
      error =
        'Use whole work/rest seconds (work 1–86,400, rest 0–86,400) and 1–1,000 rounds.';
      return;
    }
    error = '';
    void unlockAudio();
    if (status === 'finished') {
      base = 0;
      elapsed = 0;
    }
    started = Date.now();
    status = 'running';
    restored = false;
    persist();
    active();
  }
  function pause() {
    tick();
    if (status !== 'running') return;
    base = elapsed;
    status = 'paused';
    persist();
    active();
  }
  function reset() {
    status = 'idle';
    base = 0;
    elapsed = 0;
    laps = [];
    error = '';
    restored = false;
    persist();
    active();
  }
  function lap() {
    tick();
    if (laps.length >= 1000) {
      warning = 'The 1,000-lap limit has been reached.';
      return;
    }
    laps = [
      ...laps,
      { total: elapsed, split: elapsed - (laps.at(-1)?.total || 0) },
    ];
    persist();
  }
  async function fullscreen() {
    full = !full;
    if (full) {
      try {
        await element.requestFullscreen();
      } catch {
        /* CSS fallback */
      }
    } else if (document.fullscreenElement)
      await document.exitFullscreen().catch(() => {});
  }
</script>

<section
  bind:this={element}
  class="calculator-card timer-card"
  class:fullscreen-fallback={full}
  aria-label={intervals ? 'Interval timer' : 'Stopwatch'}
>
  {#if warning}<p class="notice" role="status">{warning}</p>{/if}
  {#if intervals && status === 'idle'}
    <div class="form-grid">
      {#each [['work', 'Work seconds'], ['rest', 'Rest seconds'], ['rounds', 'Rounds']] as [key, label]}<div
          class="field"
        >
          <label for={key}>{label}</label><input
            id={key}
            type="number"
            min={key === 'rest' ? '0' : '1'}
            max={key === 'rounds' ? '1000' : '86400'}
            step="1"
            value={inputs[key]}
            oninput={(e) => {
              inputs[key] = e.currentTarget.value;
            }}
          />
        </div>{/each}
    </div>
    <p class="deadline-preview">
      Session: {valid ? displayMilliseconds(total) : 'Check your inputs'} · no final
      rest
    </p>
  {/if}
  <p class="eyebrow">
    {intervals && status !== 'idle'
      ? `${position.phase} · Round ${position.round} of ${inputs.rounds}`
      : status === 'paused'
        ? 'Paused'
        : intervals
          ? 'Ready for a round?'
          : 'Elapsed time'}
  </p>
  <div class="timer-display">
    {intervals
      ? displayMilliseconds(
          status === 'idle' ? +inputs.work * 1000 || 0 : position.remaining,
        )
      : displayMilliseconds(elapsed, true)}
  </div>
  {#if intervals}<progress
      max={total || 1}
      value={elapsed}
      aria-label="Session progress"
    ></progress>{/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  <div class="running-controls">
    {#if status === 'running'}<button class="primary" onclick={pause}
        >Pause</button
      >{:else}<button class="primary" onclick={start} disabled={!ready}
        >{status === 'paused'
          ? 'Resume'
          : status === 'finished'
            ? 'Start again'
            : 'Start'}</button
      >{/if}
    {#if !intervals}<button
        class="secondary"
        onclick={lap}
        disabled={status !== 'running'}>Lap</button
      >{/if}
    <button class="secondary" onclick={reset} disabled={status === 'idle'}
      >Reset</button
    >
    <button class="secondary" onclick={fullscreen}
      >{full ? 'Exit fullscreen' : 'Fullscreen'}</button
    >
  </div>
  {#if restored}<button
      class="quiet"
      onclick={async () => {
        await unlockAudio();
        restored = false;
      }}>Enable sound for restored session</button
    >{/if}
  {#if intervals}<div class="sound-setting">
      <label for="interval-sound">Transition sound</label><select
        id="interval-sound"
        bind:value={sound}
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
    <p class="browser-note">
      Keep this tab available. A sleeping or closed browser cannot guarantee
      transition alarms.
    </p>{/if}
  {#if status === 'finished'}<p class="notice" role="status">
      Session complete.
    </p>{/if}
  {#if laps.length}<div class="result-table">
      <table>
        <caption>Laps</caption><thead
          ><tr><th>Lap</th><th>Split</th><th>Total</th></tr></thead
        ><tbody
          >{#each laps.toReversed() as l, i}<tr
              ><th scope="row">{laps.length - i}</th><td
                >{displayMilliseconds(l.split, true)}</td
              ><td>{displayMilliseconds(l.total, true)}</td></tr
            >{/each}</tbody
        >
      </table>
    </div>{/if}
  <Actions
    values={inputs}
    path={intervals ? '/interval-timer/' : '/stopwatch/'}
    text={intervals
      ? `${inputs.rounds} rounds: ${inputs.work}s work / ${inputs.rest}s rest · ${displayMilliseconds(total)} total`
      : `${displayMilliseconds(elapsed, true)} elapsed${laps.length ? '\n' + laps.map((l, i) => `Lap ${i + 1}: ${displayMilliseconds(l.split, true)} split / ${displayMilliseconds(l.total, true)} total`).join('\n') : ''}`}
    disabled={!ready || (intervals && !valid)}
  />
</section>
