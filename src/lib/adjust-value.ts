import Decimal from 'decimal.js';
import { duration, formatDuration, clockMinutes } from './duration';

export type Adjustment = {
  kind: 'number' | 'auto' | 'time' | 'date';
  step?: number;
  min?: number;
  max?: number;
  integer?: boolean;
};

export function adjustmentStep(
  value: string,
  options: Adjustment,
  fine = false,
): number {
  const durationValue = options.kind === 'auto' && value.includes(':');
  const base =
    options.step ?? (durationValue || options.kind === 'time' ? 60 : 1);
  if (!fine || options.integer || options.kind === 'date') return base;
  return durationValue || options.kind === 'time' ? 1 : base / 10;
}

// Units are numbers, duration/clock seconds, or calendar days. Invalid/blank
// input stays editable instead of being replaced by an invented starting value.
export function adjustValue(
  value: string,
  steps: number,
  options: Adjustment,
  fine = false,
): string | null {
  if (!value.trim() || !Number.isFinite(steps)) return null;
  try {
    const step = adjustmentStep(value, options, fine);
    if (options.kind === 'date') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
      const date = Date.parse(value + 'T00:00:00Z');
      if (
        !Number.isFinite(date) ||
        new Date(date).toISOString().slice(0, 10) !== value
      )
        return null;
      const next = Math.min(
        Date.parse('9999-12-31T00:00:00Z'),
        Math.max(
          Date.parse('0001-01-01T00:00:00Z'),
          date + Math.trunc(steps * step) * 86400000,
        ),
      );
      return new Date(next).toISOString().slice(0, 10);
    }
    if (options.kind === 'time') {
      const seconds = Math.round(
        Math.min(86399, Math.max(0, clockMinutes(value) * 60 + steps * step)),
      );
      const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
      const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
      const s = String(seconds % 60).padStart(2, '0');
      return value.split(':').length === 3 || seconds % 60
        ? `${h}:${m}:${s}`
        : `${h}:${m}`;
    }
    const isDuration = options.kind === 'auto' && value.includes(':');
    const normal = value.replace('−', '-');
    if (!isDuration && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normal))
      return null;
    const initial = isDuration ? duration(normal) : new Decimal(normal);
    if (!initial.isFinite() || initial.abs().gt(1e12)) return null;
    let next = initial.add(new Decimal(step).mul(steps));
    next = Decimal.max(
      options.min ?? -1e12,
      Decimal.min(options.max ?? 1e12, next),
    );
    if (options.integer) next = next.round();
    return isDuration
      ? formatDuration(next).replace('−', '-')
      : next.toDecimalPlaces(6).toString();
  } catch {
    return null;
  }
}
