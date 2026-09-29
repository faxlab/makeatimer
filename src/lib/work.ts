import Decimal from 'decimal.js';
import {
  number,
  duration,
  positiveDuration,
  formatDuration,
  decimal,
  clockSpan,
  clockMinutes,
} from './duration';
import type { Values, Result } from './types';
const units: Record<string, number> = {
  seconds: 1,
  minutes: 60,
  hours: 3600,
  days: 86400,
  weeks: 604800,
};
export function calculate(id: string, v: Values): Result {
  switch (id) {
    case 'time-calculator': {
      const a = duration(v.a);
      const b =
        v.operation === 'multiply' || v.operation === 'divide'
          ? number(v.b, 'Multiplier / divisor')
          : duration(v.b);
      let total: Decimal;
      switch (v.operation) {
        case 'add':
          total = a.add(b);
          break;
        case 'subtract':
          total = a.sub(b);
          break;
        case 'multiply':
          total = a.mul(b);
          break;
        case 'divide':
          if (b.isZero()) throw new Error('Cannot divide by zero.');
          total = a.div(b);
          break;
        default:
          throw new Error('Choose a supported operation.');
      }
      return {
        value: formatDuration(total),
        detail: `${decimal(total)} seconds · ${decimal(total.div(3600))} hours`,
      };
    }
    case 'sum-durations': {
      const lines = v.list.split(/\r?\n/).filter((x) => x.trim());
      if (!lines.length || lines.length > 1000)
        throw new Error('Enter between 1 and 1,000 durations, one per line.');
      const total = lines.reduce(
        (sum, line) => sum.add(duration(line)),
        new Decimal(0),
      );
      return {
        value: formatDuration(total),
        detail: `${lines.length} durations · ${decimal(total.div(3600))} hours`,
      };
    }
    case 'time-between': {
      const s = clockSpan(v.start, v.end, v.overnight);
      return {
        value: formatDuration(s),
        detail: `${decimal(s.div(60))} minutes · fixed clock arithmetic`,
      };
    }
    case 'work-hours': {
      const span = clockSpan(v.start, v.end, v.overnight);
      const breaks = number(v.breaks, 'Break minutes', 0).mul(60);
      if (breaks.gt(span)) throw new Error('Breaks cannot exceed the shift.');
      const s = span.sub(breaks);
      return {
        value: formatDuration(s),
        detail: `${decimal(s.div(3600))} paid hours · ${v.breaks} minutes of breaks`,
      };
    }
    case 'timesheet': {
      let total = new Decimal(0);
      const rows: [string, string][] = [];
      let csv = 'Day,Start,End,Next day,Break minutes,Hours\r\n';
      for (const [i, day] of [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ].entries()) {
        if (!v[`start${i}`] && !v[`end${i}`]) continue;
        const span = clockSpan(
          v[`start${i}`],
          v[`end${i}`],
          v[`overnight${i}`],
        );
        const breaks = number(v[`break${i}`], `${day} break`, 0).mul(60);
        if (breaks.gt(span))
          throw new Error(`${day}: breaks cannot exceed the shift.`);
        const s = span.sub(breaks);
        total = total.add(s);
        rows.push([day, formatDuration(s)]);
        csv += `${day},${v[`start${i}`]},${v[`end${i}`]},${v[`overnight${i}`]},${v[`break${i}`]},${decimal(s.div(3600))}\r\n`;
      }
      csv += `Total,,,,,${decimal(total.div(3600))}\r\n`;
      return {
        value: `${decimal(total.div(3600))} hours`,
        detail: `${formatDuration(total)} total · hours only; no overtime or payroll rules`,
        rows,
        csv,
      };
    }
    case 'decimal-hours': {
      if (!['to-decimal', 'to-duration'].includes(v.direction))
        throw new Error('Choose a conversion direction.');
      const s =
        v.direction === 'to-decimal'
          ? duration(v.amount)
          : number(v.amount, 'Decimal hours').mul(3600);
      return {
        value:
          v.direction === 'to-decimal'
            ? `${decimal(s.div(3600))} hours`
            : formatDuration(s),
        detail: `${decimal(s.div(60))} minutes. Decimal hours use base 10, not clock minutes.`,
      };
    }
    case 'time-units': {
      if (!units[v.from] || !units[v.to])
        throw new Error('Choose supported units.');
      const s = number(v.amount, 'Amount').mul(units[v.from]);
      return {
        value: `${decimal(s.div(units[v.to]))} ${v.to}`,
        detail: 'Fixed units: one day = 24 hours; one week = 7 days.',
      };
    }
    case 'start-finish': {
      if (!['finish', 'start'].includes(v.direction))
        throw new Error('Choose start or finish.');
      const base = new Decimal(clockMinutes(v.time)).mul(60);
      const offset = positiveDuration(v.duration).mul(
        v.direction === 'finish' ? 1 : -1,
      );
      const s = base.add(offset);
      const days = s.div(86400).floor();
      const clock = s.sub(days.mul(86400));
      return {
        value: formatDuration(clock)
          .split(':')
          .map((x, i) => (i === 0 ? x.padStart(2, '0') : x))
          .join(':'),
        detail: `${days.isZero() ? 'Same day' : `${days.gt(0) ? '+' : ''}${days} day(s)`} · fixed clock arithmetic, independent of daylight saving`,
      };
    }
    default:
      throw new Error('Unknown work calculator.');
  }
}
