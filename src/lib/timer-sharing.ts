import type { Values } from './types';
import type { TimerState } from './timing';

function durationTotal(values: Values) {
  const parts = [values.hours, values.minutes, values.seconds];
  if (!parts.every((value) => /^\d+$/.test(value)))
    throw new Error('Use whole, nonnegative hours, minutes, and seconds.');
  const [hours, minutes, seconds] = parts.map(Number);
  if (hours > 8760 || minutes > 59 || seconds > 59)
    throw new Error('Minutes and seconds must be 0–59; hours must be 0–8,760.');
  const total = (hours * 3600 + minutes * 60 + seconds) * 1000;
  if (!total) throw new Error('Enter a duration greater than zero.');
  return total;
}

export function timerLinkValues(
  values: Values,
  timer: TimerState | null,
  deadline?: number | null,
): Values {
  const shared: Values = {
    mode: values.mode,
    zone: values.zone,
    state: timer?.status || 'setup',
  };
  if (values.mode === 'duration') {
    for (const key of ['hours', 'minutes', 'seconds'])
      shared[key] = values[key];
  } else {
    for (const key of ['time', 'date', 'choice'])
      if (values[key]) shared[key] = values[key];
  }
  if (values.label) shared.label = values.label;
  if (timer?.status === 'paused') shared.remaining = String(timer.remaining);
  else if (timer) shared.instant = new Date(timer.end).toISOString();
  else if (
    deadline !== undefined &&
    deadline !== null &&
    Number.isFinite(deadline)
  )
    shared.instant = new Date(deadline).toISOString();
  else if (values.instant) shared.instant = values.instant;
  return shared;
}

// A running link is anchored to an absolute instant; paused links retain their
// remaining time. Only an unstarted duration begins a new duration on opening.
export function timerFromLink(
  values: Values,
  now: number,
  deadline?: number,
): TimerState {
  if (!['duration', 'until'].includes(values.mode))
    throw new Error('This shared timer mode is not supported.');
  const state = values.state || 'setup';
  if (!['setup', 'running', 'paused', 'finished'].includes(state))
    throw new Error('This shared timer state is not supported.');
  const kind = values.mode === 'duration' ? 'duration' : 'deadline';
  const total =
    kind === 'duration'
      ? durationTotal(values)
      : Math.max(1, (deadline ?? NaN) - now);
  if (state === 'paused') {
    if (kind !== 'duration' || !/^\d+$/.test(values.remaining || ''))
      throw new Error('This paused timer is invalid.');
    const remaining = Number(values.remaining);
    if (remaining > total) throw new Error('This paused timer is invalid.');
    return {
      kind,
      total,
      remaining,
      end: now + remaining,
      status: remaining ? 'paused' : 'finished',
      zone: values.zone,
    };
  }
  if (values.instant && !Number.isFinite(deadline))
    throw new Error('This shared finishing time is invalid.');
  const end = deadline ?? (kind === 'duration' ? now + total : NaN);
  if (!Number.isFinite(end) || end < 0 || end - now > 315360000000)
    throw new Error('Choose a valid finishing time within ten years.');
  const remaining = Math.max(0, end - now);
  return {
    kind,
    total: Math.max(total, remaining),
    remaining: state === 'finished' ? 0 : remaining,
    end,
    status: state === 'finished' || !remaining ? 'finished' : 'running',
    zone: values.zone,
  };
}
