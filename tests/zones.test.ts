import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveZoned, untilTarget, formatInstant } from '../src/lib/zones';
import { calculate } from '../src/lib/calendar';
test('spring-forward gaps are rejected for every resolution', () => {
  for (const choice of ['reject', 'earlier', 'later'])
    assert.throws(
      () => resolveZoned('2026-03-08', '02:30', 'America/New_York', choice),
      /does not exist/,
    );
});
test('fall-back overlaps require an explicit choice', () => {
  assert.throws(
    () => resolveZoned('2026-11-01', '01:30', 'America/New_York'),
    /occurs twice/,
  );
  const early = resolveZoned(
    '2026-11-01',
    '01:30',
    'America/New_York',
    'earlier',
  );
  const late = resolveZoned('2026-11-01', '01:30', 'America/New_York', 'later');
  assert.equal(late.epochMilliseconds - early.epochMilliseconds, 3600000);
});
test('fixed PST differs from Los Angeles in summer', () => {
  const fixed = resolveZoned('2026-07-01', '09:00', '-08:00');
  const seasonal = resolveZoned('2026-07-01', '09:00', 'America/Los_Angeles');
  assert.equal(fixed.epochMilliseconds - seasonal.epochMilliseconds, 3600000);
});
test('fractional offsets and midnight rollover preserve instants', () => {
  const a = resolveZoned('2026-01-01', '00:15', 'Asia/Kathmandu');
  assert.equal(
    new Date(a.epochMilliseconds).toISOString(),
    '2025-12-31T18:30:00.000Z',
  );
  assert.match(
    formatInstant(a.epochMilliseconds, 'Asia/Kolkata'),
    /2026-01-01 00:00:00/,
  );
});
test('Until picks today or tomorrow in the destination zone', () => {
  const now = Date.parse('2026-01-01T23:00:00Z');
  assert.equal(untilTarget('23:30', 'UTC', '', 'reject', now).label, 'Today');
  const tomorrow = untilTarget('01:00', 'UTC', '', 'reject', now);
  assert.equal(tomorrow.label, 'Tomorrow');
  assert.equal(
    new Date(tomorrow.epoch).toISOString(),
    '2026-01-02T01:00:00.000Z',
  );
  assert.throws(
    () => untilTarget('22:00', 'UTC', '2026-01-01', 'reject', now),
    /future/,
  );
});
test('invalid zones, dates, disambiguation and future gaps are never silently shifted', () => {
  assert.throws(() => resolveZoned('2026-01-01', '12:00', 'Not/A_Zone'));
  assert.throws(() => resolveZoned('2026-01-01', '12:00', 'UTC', 'compatible'));
  assert.throws(
    () =>
      untilTarget(
        '02:30',
        'America/New_York',
        '',
        'reject',
        Date.parse('2026-03-08T05:00:00Z'),
      ),
    /does not exist/,
  );
});
test('meeting planner fits the entire slot and supports up to four zones', () => {
  const v = {
    date: '2026-01-15',
    zone1: 'Europe/London',
    zone2: 'America/New_York',
    zone3: '',
    zone4: '',
    start: '9',
    end: '17',
  };
  const r = calculate('meeting-planner', v);
  assert.equal(r.rows?.length, 6);
  assert.equal(r.rows?.[0][0], '14:00–14:30');
  assert.equal(r.rows?.at(-1)?.[0], '16:30–17:00');
  assert.equal(
    calculate('meeting-planner', {
      ...v,
      zone3: 'Asia/Tokyo',
      zone4: 'Australia/Sydney',
    }).value,
    'No overlap',
  );
});
