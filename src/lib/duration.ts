import Decimal from 'decimal.js';
Decimal.set({ precision: 40 });
export function number(
  value: string,
  label = 'Value',
  minimum?: number,
  maximum = 1e12,
): Decimal {
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim()))
    throw new Error(`${label} must be a number.`);
  const n = new Decimal(value);
  if (
    !n.isFinite() ||
    n.abs().gt(maximum) ||
    (minimum !== undefined && n.lt(minimum))
  )
    throw new Error(
      `${label} must be ${minimum !== undefined ? `between ${minimum} and ${maximum}` : `within ±${maximum}`}.`,
    );
  return n;
}
export function duration(value: string): Decimal {
  const match = /^([+-]?)(\d+):(\d{2})(?::(\d{2}(?:\.\d+)?))?$/.exec(
    value.trim(),
  );
  if (!match)
    throw new Error(
      'Use hours:minutes or hours:minutes:seconds, for example 1:30:00.',
    );
  const [, sign, h, m, s = '0'] = match;
  if (+m >= 60 || +s >= 60)
    throw new Error('Minutes and seconds must be below 60.');
  const total = number(h, 'Hours', 0)
    .mul(3600)
    .add(new Decimal(m).mul(60))
    .add(s);
  if (total.gt(1e12)) throw new Error('Duration is too large.');
  return sign === '-' ? total.negated() : total;
}
export function positiveDuration(value: string): Decimal {
  const n = duration(value);
  if (n.lt(0)) throw new Error('Duration must be zero or positive.');
  return n;
}
export function formatDuration(value: Decimal.Value, precision = 3): string {
  const n = new Decimal(value).abs().toDecimalPlaces(precision);
  const hours = n.div(3600).floor();
  const minutes = n.mod(3600).div(60).floor();
  const seconds = n
    .mod(60)
    .toFixed(precision)
    .replace(/(\.\d*?)0+$/, '$1')
    .replace(/\.$/, '');
  const [whole, fraction] = seconds.split('.');
  return `${new Decimal(value).lt(0) ? '−' : ''}${hours.toFixed(0)}:${minutes.toFixed(0).padStart(2, '0')}:${whole.padStart(2, '0')}${fraction ? `.${fraction}` : ''}`;
}
export function decimal(value: Decimal.Value, precision = 6): string {
  return new Decimal(value).toDecimalPlaces(precision).toString();
}
export function clockMinutes(value: string): number {
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(value))
    throw new Error('Enter a clock time.');
  const [h, m, s = 0] = value.split(':').map(Number);
  if (h > 23 || m > 59 || s > 59) throw new Error('Invalid clock time.');
  return h * 60 + m + s / 60;
}
export function clockSpan(
  start: string,
  end: string,
  overnight: string,
): Decimal {
  let minutes = clockMinutes(end) - clockMinutes(start);
  if (overnight === 'yes') minutes += 1440;
  if (minutes < 0 || minutes > 1440)
    throw new Error(
      'Select next day for an overnight shift. Shifts must be no longer than 24 hours.',
    );
  return new Decimal(minutes).mul(60);
}
