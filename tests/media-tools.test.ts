import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from '../src/lib/rates';
import { getTool } from '../src/lib/tools';
import { guides } from '../src/lib/guides';
import type { Values } from '../src/lib/types';

const inputs = (id: string, overrides: Values = {}) => ({
  ...Object.fromEntries(
    getTool(id).fields.map((field) => [field.key, field.default]),
  ),
  ...overrides,
});

test('playback savings, slower playback, normal speed and zero duration', () => {
  for (const [speed, duration, value, label, difference] of [
    ['1.5', '1:00:00', '0:40:00', 'Time saved', '0:20:00'],
    ['0.75', '1:00:00', '1:20:00', 'Extra time', '0:20:00'],
    ['1', '1:00:00', '1:00:00', 'Time saved', '0:00:00'],
    ['1.25', '8:00:00', '6:24:00', 'Time saved', '1:36:00'],
    ['1.5', '0:00:00', '0:00:00', 'Time saved', '0:00:00'],
    ['0.75', '0:00:00', '0:00:00', 'Time saved', '0:00:00'],
    ['3', '0:00:01', '0:00:00.333', 'Time saved', '0:00:00.667'],
  ]) {
    const result = calculate(
      'playback-speed',
      inputs('playback-speed', { speed, duration }),
    );
    assert.equal(result.value, value);
    assert.deepEqual(result.rows, [[label, difference]]);
  }
  assert.deepEqual(
    getTool('playback-speed').defaultResult,
    calculate('playback-speed', inputs('playback-speed')),
  );
  for (const speed of ['0', '-1', '101', 'invalid'])
    assert.throws(() =>
      calculate('playback-speed', inputs('playback-speed', { speed })),
    );
});

test('guide render estimates and an incomplete final batch match independent references', () => {
  const rows = [
    ['1', '240', '2:12:00'],
    ['2', '120', '1:06:00'],
    ['4', '60', '0:33:00'],
    ['8', '30', '0:16:30'],
  ];
  assert.deepEqual(guides['render-time'].table.rows, rows);
  for (const [workers, , expected] of rows)
    assert.equal(
      calculate('render-time', inputs('render-time', { workers })).value,
      expected,
    );
  assert.equal(
    calculate(
      'render-time',
      inputs('render-time', { frames: '10', workers: '3', overhead: '0' }),
    ).value,
    '0:02:00',
  );
  assert.equal(
    calculate(
      'render-time',
      inputs('render-time', { frames: '1', workers: '8', overhead: '0' }),
    ).value,
    '0:00:30',
  );
});

test('frame comparisons and literal decimal FPS preserve elapsed-time calculations', () => {
  const rows = [
    ['24', '100', '0:01:40'],
    ['25', '96', '0:01:36'],
    ['30', '80', '0:01:20'],
    ['60', '40', '0:00:40'],
  ];
  assert.deepEqual(guides['frames-duration'].table.rows, rows);
  for (const [fps, , expected] of rows)
    assert.equal(
      calculate('frames-duration', inputs('frames-duration', { fps })).value,
      expected,
    );
  assert.equal(
    calculate('frames-duration', inputs('frames-duration', { fps: '23.976' }))
      .value,
    '0:01:40.1001',
  );
  assert.equal(
    calculate(
      'frames-duration',
      inputs('frames-duration', { frames: '1440', fps: '24' }),
    ).value,
    '0:01:00',
  );
  assert.equal(
    calculate(
      'frames-duration',
      inputs('frames-duration', { frames: '300', fps: '30' }),
    ).value,
    '0:00:10',
  );
});

test('playback comparison table matches independently specified durations and changes', () => {
  const rows = [
    ['0.75×', '1:20:00', '20 minutes extra'],
    ['1×', '1:00:00', '0 minutes saved'],
    ['1.25×', '0:48:00', '12 minutes saved'],
    ['1.5×', '0:40:00', '20 minutes saved'],
    ['2×', '0:30:00', '30 minutes saved'],
  ];
  assert.deepEqual(guides['playback-speed'].table.rows, rows);
  for (const [label, expected] of rows)
    assert.equal(
      calculate(
        'playback-speed',
        inputs('playback-speed', { speed: label.replace('×', '') }),
      ).value,
      expected,
    );
});
