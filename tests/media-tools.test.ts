import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from '../src/lib/rates';
import { calculate as calculateWork } from '../src/lib/work';
import { decodeShare, encodeShare } from '../src/lib/share';
import { getTool } from '../src/lib/tools';
import { guides } from '../src/lib/guides';
import type { Values } from '../src/lib/types';

const inputs = (id: string, overrides: Values = {}) => ({
  ...Object.fromEntries(
    getTool(id).fields.map((field) => [field.key, field.default]),
  ),
  ...overrides,
});

test('calculation handoffs round-trip through destination defaults and preserve displayed duration', () => {
  const frames = calculate(
    'frames-duration',
    inputs('frames-duration', { frames: '240' }),
  );
  const renderLink = frames.nextCalculation!;
  const renderInputs = decodeShare(
    encodeShare(renderLink.values),
    inputs(renderLink.tool),
  );
  assert.equal(renderInputs.warning, '');
  assert.equal(renderInputs.values.frames, '240');
  assert.equal(renderInputs.values.workers, '4');
  const render = calculate(renderLink.tool, renderInputs.values);
  assert.equal(render.value, '0:33:00');
  const finishLink = render.nextCalculation!;
  const finishInputs = decodeShare(
    encodeShare(finishLink.values),
    inputs(finishLink.tool),
  );
  assert.equal(finishInputs.warning, '');
  assert.equal(finishInputs.values.direction, 'finish');
  assert.equal(finishInputs.values.duration, '0:33:00');
  const finish = calculateWork(finishLink.tool, {
    ...finishInputs.values,
    time: '23:45',
  });
  assert.equal(finish.value, '00:18:00');
  assert.match(finish.detail, /^\+1 day/);

  const fractional = calculate(
    'render-time',
    inputs('render-time', {
      frames: '10',
      seconds: '0.1234',
      workers: '3',
      overhead: '10',
    }),
  );
  assert.equal(fractional.value, '0:00:00.543');
  assert.equal(fractional.nextCalculation!.values.duration, fractional.value);
  assert.equal(
    calculateWork(
      'start-finish',
      inputs('start-finish', fractional.nextCalculation!.values),
    ).value,
    '09:00:00.543',
  );
});

test('handoffs respect destination bounds without rejecting valid source calculations', () => {
  for (const frames of ['0', '1000000001'])
    assert.equal(
      calculate('frames-duration', inputs('frames-duration', { frames }))
        .nextCalculation,
      undefined,
    );
  for (const frames of ['1', '1000000000'])
    assert.equal(
      calculate('frames-duration', inputs('frames-duration', { frames }))
        .nextCalculation!.values.frames,
      frames,
    );
  const largest = calculate(
    'render-time',
    inputs('render-time', {
      frames: '1',
      seconds: '1000000000000',
      workers: '1',
      overhead: '0',
    }),
  );
  assert.doesNotThrow(() =>
    calculateWork(
      'start-finish',
      inputs('start-finish', largest.nextCalculation!.values),
    ),
  );
  const tooLarge = calculate(
    'render-time',
    inputs('render-time', {
      frames: '2',
      seconds: '1000000000000',
      workers: '1',
      overhead: '0',
    }),
  );
  assert.equal(tooLarge.nextCalculation, undefined);
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
