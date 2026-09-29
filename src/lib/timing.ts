export type TimerState = {
  kind: 'duration' | 'deadline';
  total: number;
  remaining: number;
  end: number;
  status: 'running' | 'paused' | 'finished';
  zone: string;
};
export function remainingTime(timer: TimerState, now: number): number {
  return timer.status === 'running'
    ? Math.max(0, timer.end - now)
    : timer.remaining;
}
export function pauseTimer(timer: TimerState, now: number): TimerState {
  if (timer.kind !== 'duration' || timer.status !== 'running') return timer;
  const remaining = remainingTime(timer, now);
  return { ...timer, remaining, status: remaining ? 'paused' : 'finished' };
}
export function resumeTimer(timer: TimerState, now: number): TimerState {
  return timer.status === 'paused'
    ? { ...timer, end: now + timer.remaining, status: 'running' }
    : timer;
}
export function validateTimer(value: unknown): TimerState | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as TimerState;
  if (
    !['duration', 'deadline'].includes(v.kind) ||
    !['running', 'paused', 'finished'].includes(v.status) ||
    ![v.total, v.remaining, v.end].every(Number.isFinite) ||
    v.total <= 0 ||
    v.total > 315360000000 ||
    v.remaining < 0 ||
    v.remaining > v.total ||
    v.end < 0 ||
    v.end > 8640000000000000 ||
    typeof v.zone !== 'string'
  )
    return null;
  return v;
}
export type IntervalPosition = {
  phase: 'Work' | 'Rest' | 'Complete';
  round: number;
  remaining: number;
  complete: boolean;
};
export function intervalPosition(
  elapsed: number,
  work: number,
  rest: number,
  rounds: number,
): IntervalPosition {
  const total = work * rounds + rest * (rounds - 1);
  if (elapsed >= total)
    return { phase: 'Complete', round: rounds, remaining: 0, complete: true };
  const round = Math.floor(elapsed / (work + rest));
  const offset = elapsed - round * (work + rest);
  const phase = offset < work ? 'Work' : 'Rest';
  return {
    phase,
    round: round + 1,
    remaining: (phase === 'Work' ? work : work + rest) - offset,
    complete: false,
  };
}
export function displayMilliseconds(ms: number, stopwatch = false): string {
  const seconds = stopwatch ? Math.floor(ms / 1000) : Math.ceil(ms / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h ? `${String(h).padStart(2, '0')}:` : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}${
    stopwatch
      ? `.${Math.floor((ms % 1000) / 10)
          .toString()
          .padStart(2, '0')}`
      : ''
  }`;
}
