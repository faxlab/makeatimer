import { Temporal, resolveZoned, formatInstant } from './zones';
import { number } from './duration';
import type { Values, Result } from './types';
function date(value: string) {
  try {
    const d = Temporal.PlainDate.from(value);
    if (d.year < 1 || d.year > 9999) throw new Error();
    return d;
  } catch {
    throw new Error('Enter a valid date between years 0001 and 9999.');
  }
}
const weekdays = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];
export function calculate(id: string, v: Values): Result {
  switch (id) {
    case 'date-difference': {
      const a = date(v.start);
      const b = date(v.end);
      const days = a.until(b).days;
      const calendar = a.until(b, { largestUnit: 'years' });
      return {
        value: `${days} days`,
        detail: `${calendar.years} years, ${calendar.months} months, ${calendar.days} days · end date excluded`,
      };
    }
    case 'add-dates': {
      if (!['add', 'subtract'].includes(v.operation))
        throw new Error('Choose add or subtract.');
      const days = number(v.days, 'Days', 0, 1000000);
      const months = number(v.months, 'Months', 0, 12000);
      const years = number(v.years, 'Years', 0, 1000);
      if (![days, months, years].every((n) => n.isInteger()))
        throw new Error('Calendar offsets must be whole numbers.');
      const offset = {
        days: days.toNumber(),
        months: months.toNumber(),
        years: years.toNumber(),
      };
      const a = date(v.date);
      const b = v.operation === 'add' ? a.add(offset) : a.subtract(offset);
      date(b.toString());
      return {
        value: b.toString(),
        detail: `${weekdays[b.dayOfWeek - 1]} · month-end dates are clamped to the last valid day`,
      };
    }
    case 'business-days': {
      const start = date(v.start);
      const end = date(v.end);
      const days = start.until(end).days;
      if (days < 0 || days > 36600)
        throw new Error(
          'End date must be on or after the start, within 100 years.',
        );
      const week = v.week.split(',').map((x) => Number(x.trim()));
      if (
        !week.length ||
        !week.every((x) => Number.isInteger(x) && x >= 1 && x <= 7)
      )
        throw new Error(
          'Enter working weekdays as numbers 1–7, separated by commas.',
        );
      const excluded = new Set(
        v.excluded
          .split(/[\s,]+/)
          .filter(Boolean)
          .map((x) => date(x).toString()),
      );
      let count = 0;
      const inclusive = v.inclusive === 'yes';
      if (!['yes', 'no'].includes(v.inclusive))
        throw new Error('Choose whether to include the end date.');
      for (let i = 0; i < days + (inclusive ? 1 : 0); i++) {
        const d = start.add({ days: i });
        if (week.includes(d.dayOfWeek) && !excluded.has(d.toString())) count++;
      }
      return {
        value: `${count} business days`,
        detail: `Start included; end ${inclusive ? 'included' : 'excluded'}. Only your excluded dates are treated as holidays.`,
      };
    }
    case 'weekday': {
      const d = date(v.date);
      return {
        value: weekdays[d.dayOfWeek - 1],
        detail: `${d} · day ${d.dayOfYear} of ${d.daysInYear}`,
      };
    }
    case 'iso-week': {
      const d = date(v.date);
      return {
        value: `${d.yearOfWeek}-W${String(d.weekOfYear).padStart(2, '0')}`,
        detail: `ISO weekday ${d.dayOfWeek} (${weekdays[d.dayOfWeek - 1]}). Week 1 contains January 4.`,
      };
    }
    case 'time-zone': {
      const z = resolveZoned(date(v.date).toString(), v.time, v.from, v.choice);
      return {
        value: formatInstant(z.epochMilliseconds, v.to),
        detail: `Same instant as ${formatInstant(z.epochMilliseconds, v.from)}`,
      };
    }
    case 'meeting-planner': {
      const zones = [v.zone1, v.zone2, v.zone3, v.zone4].filter(Boolean);
      if (zones.length < 2 || zones.length > 4)
        throw new Error('Choose two to four time zones.');
      const start = number(v.start, 'Working-day start hour', 0, 23);
      const end = number(v.end, 'Working-day end hour', 1, 24);
      if (!start.isInteger() || !end.isInteger() || !start.lt(end))
        throw new Error('Use whole working hours with end after start.');
      const day = date(v.date);
      const begin = resolveZoned(day.toString(), '00:00', zones[0], 'earlier');
      const finish = resolveZoned(
        day.add({ days: 1 }).toString(),
        '00:00',
        zones[0],
        'earlier',
      );
      const rows: [string, string][] = [];
      let slots = 0;
      for (
        let t = begin.epochMilliseconds;
        t + 30 * 60000 <= finish.epochMilliseconds;
        t += 30 * 60000
      ) {
        const starts = zones.map((zone) =>
          Temporal.Instant.fromEpochMilliseconds(t).toZonedDateTimeISO(zone),
        );
        const ends = zones.map((zone) =>
          Temporal.Instant.fromEpochMilliseconds(
            t + 30 * 60000 - 1,
          ).toZonedDateTimeISO(zone),
        );
        if (
          starts.every(
            (z, i) =>
              z.hour >= start.toNumber() &&
              z.hour < end.toNumber() &&
              ends[i].hour >= start.toNumber() &&
              ends[i].hour < end.toNumber() &&
              ends[i].toPlainDate().equals(z.toPlainDate()),
          )
        ) {
          slots++;
          rows.push([
            `${starts[0].toPlainTime().toString({ smallestUnit: 'minute' })}–${Temporal.Instant.fromEpochMilliseconds(
              t + 30 * 60000,
            )
              .toZonedDateTimeISO(zones[0])
              .toPlainTime()
              .toString({ smallestUnit: 'minute' })}`,
            starts
              .map(
                (z) =>
                  `${z.toPlainDate()} ${z.toPlainTime().toString({ smallestUnit: 'minute' })} · ${z.timeZoneId}`,
              )
              .join(' | '),
          ]);
        }
      }
      return {
        value: slots ? `${slots} half-hour meeting slots` : 'No overlap',
        detail: `Date in ${zones[0]}. Local working hours ${v.start}:00–${v.end}:00 apply to every zone; weekends are not excluded.`,
        rows,
      };
    }
    default:
      throw new Error('Unknown calendar calculator.');
  }
}
