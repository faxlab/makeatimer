import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tools, getTool } from '../src/lib/tools';
import { calculate as work } from '../src/lib/work';
import { calculate as calendar } from '../src/lib/calendar';
import { calculate as rates } from '../src/lib/rates';
import { duration, formatDuration } from '../src/lib/duration';
import type { Values } from '../src/lib/types';
const inputs = (id: string, overrides: Values = {}) => ({
  ...Object.fromEntries(getTool(id).fields.map((f) => [f.key, f.default])),
  ...overrides,
});
const reference: Record<string, string> = {
  'time-calculator': '2:15:00',
  'sum-durations': '2:30:00',
  'time-between': '8:30:00',
  'work-hours': '8:00:00',
  timesheet: '37.5 hours',
  'decimal-hours': '1.5 hours',
  'time-units': '1.5 hours',
  'start-finish': '10:30:00',
  'date-difference': '365 days',
  'add-dates': '2026-02-28',
  'business-days': '5 business days',
  weekday: 'Tuesday',
  'iso-week': '2020-W53',
  'time-zone': '2026-01-15 14:00:00 (Europe/London, UTC+00:00)',
  'meeting-planner': '6 half-hour meeting slots',
  'playback-speed': '0:40:00',
  'speech-duration': '0:05:06.923',
  'running-pace': '0:05:00 / km',
  'render-time': '0:33:00',
  'frames-duration': '0:01:40',
};
test('catalogue contains exactly 24 unique tools and valid related links', () => {
  assert.equal(tools.length, 24);
  assert.equal(new Set(tools.map((t) => t.id)).size, 24);
  for (const tool of tools) for (const id of tool.related) assert(getTool(id));
});
for (const tool of tools.filter(
  (t) => t.fields.length && t.category !== 'Timing',
)) {
  const calculate =
    tool.category === 'Calendar & zones'
      ? calendar
      : tool.category === 'Specialist'
        ? rates
        : work;
  test(`${tool.id}: independent default reference and invalid input`, () => {
    const result = calculate(tool.id, inputs(tool.id));
    assert.equal(result.value, reference[tool.id]);
    const first = tool.fields.find(
      (f) => !['select', 'zone'].includes(f.type || 'text'),
    )!;
    assert.throws(() =>
      calculate(tool.id, inputs(tool.id, { [first.key]: 'invalid' })),
    );
  });
}
test('duration parsing and display carry, fractions, zero and negative values', () => {
  assert.equal(duration('100:30').toString(), '361800');
  assert.equal(duration('-1:00:00').toString(), '-3600');
  assert.equal(formatDuration(59.9996), '0:01:00');
  assert.equal(formatDuration(6.923), '0:00:06.923');
  assert.equal(formatDuration(30, 0), '0:00:30');
  assert.equal(formatDuration(-60), '−0:01:00');
  assert.equal(formatDuration(0), '0:00:00');
  for (const bad of [
    '1:60',
    '0:00:60',
    'one hour',
    '',
    'Infinity',
    '1:2:3',
    '1:00x',
  ])
    assert.throws(() => duration(bad));
});
test('all arithmetic operations use unrounded decimals', () => {
  assert.equal(
    work(
      'time-calculator',
      inputs('time-calculator', { a: '0:00:01', operation: 'divide', b: '3' }),
    ).value,
    '0:00:00.333',
  );
  assert.equal(
    work(
      'time-calculator',
      inputs('time-calculator', { operation: 'subtract', b: '2:00:00' }),
    ).value,
    '−0:30:00',
  );
  assert.equal(
    work(
      'time-calculator',
      inputs('time-calculator', { operation: 'multiply', b: '0.1' }),
    ).value,
    '0:09:00',
  );
  assert.throws(
    () =>
      work(
        'time-calculator',
        inputs('time-calculator', { operation: 'divide', b: '0' }),
      ),
    /zero/,
  );
});
test('overnight work, excessive breaks, blank timesheets and CSV totals', () => {
  assert.equal(
    work(
      'work-hours',
      inputs('work-hours', {
        start: '22:00',
        end: '06:00',
        overnight: 'yes',
        breaks: '30',
      }),
    ).value,
    '7:30:00',
  );
  assert.throws(
    () => work('work-hours', inputs('work-hours', { breaks: '600' })),
    /exceed/,
  );
  assert.throws(
    () =>
      work(
        'time-between',
        inputs('time-between', { start: '22:00', end: '06:00' }),
      ),
    /next day/,
  );
  const blank = inputs('timesheet');
  for (let i = 0; i < 7; i++) {
    blank[`start${i}`] = '';
    blank[`end${i}`] = '';
  }
  assert.equal(work('timesheet', blank).value, '0 hours');
  assert.match(
    work('timesheet', inputs('timesheet')).csv!,
    /Total,,,,,37.5\r\n$/,
  );
  assert.throws(() => work('timesheet', { ...blank, start0: '09:00' }));
});
test('decimal conversion, fixed units and midnight start/finish', () => {
  assert.equal(
    work(
      'decimal-hours',
      inputs('decimal-hours', { direction: 'to-duration', amount: '2.75' }),
    ).value,
    '2:45:00',
  );
  assert.equal(
    work(
      'time-units',
      inputs('time-units', { amount: '2', from: 'days', to: 'seconds' }),
    ).value,
    '172800 seconds',
  );
  const before = work(
    'start-finish',
    inputs('start-finish', {
      direction: 'start',
      time: '01:00',
      duration: '2:00',
    }),
  );
  assert.equal(before.value, '23:00:00');
  assert.match(before.detail, /-1 day/);
  assert.match(
    work('start-finish', inputs('start-finish', { duration: '49:00' })).detail,
    /\+2 day/,
  );
});
test('leap days, month clamps and signed date differences', () => {
  assert.equal(
    calendar('add-dates', inputs('add-dates', { date: '2024-01-31' })).value,
    '2024-02-29',
  );
  assert.equal(
    calendar(
      'add-dates',
      inputs('add-dates', { date: '2024-02-29', months: '0', years: '1' }),
    ).value,
    '2025-02-28',
  );
  assert.equal(
    calendar(
      'date-difference',
      inputs('date-difference', { start: '2024-02-28', end: '2024-03-01' }),
    ).value,
    '2 days',
  );
  assert.equal(
    calendar(
      'date-difference',
      inputs('date-difference', { start: '2027-01-01', end: '2026-01-01' }),
    ).value,
    '-365 days',
  );
  assert.throws(() => calendar('weekday', { date: '2023-02-29' }));
  assert.throws(() =>
    calendar('add-dates', inputs('add-dates', { months: '0.5' })),
  );
});
test('custom working week, duplicates/excluded dates and inclusive end', () => {
  assert.equal(
    calendar(
      'business-days',
      inputs('business-days', {
        excluded: '2026-09-30\n2026-09-30',
        inclusive: 'yes',
      }),
    ).value,
    '5 business days',
  );
  assert.equal(
    calendar('business-days', inputs('business-days', { week: '6,7' })).value,
    '2 business days',
  );
  assert.throws(() =>
    calendar('business-days', inputs('business-days', { week: '8' })),
  );
  assert.equal(
    calendar(
      'business-days',
      inputs('business-days', { end: '2026-09-28', inclusive: 'yes' }),
    ).value,
    '1 business days',
  );
});
test('ISO week-year boundaries', () => {
  for (const [date, week] of [
    ['2021-01-04', '2021-W01'],
    ['2019-12-30', '2020-W01'],
    ['2020-12-31', '2020-W53'],
  ])
    assert.equal(calendar('iso-week', { date }).value, week);
});
test('specialist rates, partial worker batches and fractional fps', () => {
  assert.equal(
    rates('speech-duration', inputs('speech-duration', { wpm: '120' })).value,
    '0:05:30',
  );
  assert.equal(
    rates(
      'running-pace',
      inputs('running-pace', {
        distance: '3',
        unit: 'mi',
        duration: '0:24:00',
      }),
    ).value,
    '0:08:00 / mi',
  );
  assert.equal(
    rates(
      'render-time',
      inputs('render-time', {
        frames: '5',
        workers: '2',
        seconds: '10',
        overhead: '0',
      }),
    ).value,
    '0:00:30',
  );
  assert.equal(
    rates(
      'frames-duration',
      inputs('frames-duration', { frames: '2997', fps: '29.97' }),
    ).value,
    '0:01:40',
  );
  for (const [id, v] of [
    ['playback-speed', { speed: '0' }],
    ['running-pace', { duration: '0:00' }],
    ['frames-duration', { fps: '0' }],
    ['render-time', { frames: '1.5' }],
  ] as [string, Values][])
    assert.throws(() => rates(id, inputs(id, v)));
});
