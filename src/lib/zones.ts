import { Temporal } from '@js-temporal/polyfill';
export type Disambiguation = 'reject' | 'earlier' | 'later';
export const localZone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
export function resolveZoned(
  date: string,
  time: string,
  zone: string,
  choice: string = 'reject',
) {
  if (!['reject', 'earlier', 'later'].includes(choice))
    throw new Error('Choose a daylight-saving resolution.');
  const plain = Temporal.PlainDateTime.from(`${date}T${time}`);
  let result: Temporal.ZonedDateTime;
  try {
    result = plain.toZonedDateTime(zone, {
      disambiguation: choice as Disambiguation,
    });
  } catch (error) {
    try {
      const a = plain.toZonedDateTime(zone, { disambiguation: 'earlier' });
      const b = plain.toZonedDateTime(zone, { disambiguation: 'later' });
      if (
        !a.toPlainDateTime().equals(plain) ||
        !b.toPlainDateTime().equals(plain)
      )
        throw new Error(
          'This time does not exist because the clocks jump forward. Choose another time.',
        );
      if (a.epochMilliseconds !== b.epochMilliseconds)
        throw new Error(
          'This time occurs twice because the clocks go back. Choose the earlier or later occurrence.',
        );
    } catch (detail) {
      if (detail instanceof Error && /clocks/.test(detail.message))
        throw detail;
    }
    throw new Error('Enter a valid date, clock time, and time zone.');
  }
  // Earlier/later must never silently move a nonexistent clock time.
  if (!result.toPlainDateTime().equals(plain))
    throw new Error(
      'This time does not exist because the clocks jump forward. Choose another time.',
    );
  return result;
}
export function untilTarget(
  time: string,
  zone: string,
  date: string,
  choice: string,
  now = Date.now(),
) {
  const instant = Temporal.Instant.fromEpochMilliseconds(now);
  const today = instant.toZonedDateTimeISO(zone).toPlainDate();
  let target = resolveZoned(date || today.toString(), time, zone, choice);
  if (!date && target.epochMilliseconds <= now)
    target = resolveZoned(
      today.add({ days: 1 }).toString(),
      time,
      zone,
      choice,
    );
  if (target.epochMilliseconds <= now)
    throw new Error('Choose a deadline in the future.');
  const days = today.until(target.toPlainDate()).days;
  const label =
    days === 0
      ? 'Today'
      : days === 1
        ? 'Tomorrow'
        : target.toPlainDate().toString();
  return {
    epoch: target.epochMilliseconds,
    label,
    destination: `${target.toPlainTime().toString()} ${zone}`,
    local: formatInstant(target.epochMilliseconds, localZone()),
  };
}
export function formatInstant(epoch: number, zone: string): string {
  const z =
    Temporal.Instant.fromEpochMilliseconds(epoch).toZonedDateTimeISO(zone);
  return `${z.toPlainDate()} ${z.toPlainTime().toString({ smallestUnit: 'second' })} (${zone}, UTC${z.offset})`;
}
export { Temporal };
