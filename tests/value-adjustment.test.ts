import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adjustValue } from '../src/lib/adjust-value';

test('value adjustment preserves decimal precision, fine steps, and bounds', () => {
  const playback = { kind: 'number' as const, step: 0.1, min: 0.01, max: 100 };
  assert.equal(adjustValue('1.5', 3, playback), '1.8');
  assert.equal(adjustValue('1.5', 3, playback, true), '1.53');
  assert.equal(adjustValue('1.5', -100, playback), '0.01');
  assert.equal(adjustValue('99.9', 100, playback), '100');
  assert.equal(
    adjustValue(
      '59',
      10,
      { kind: 'number', min: 0, max: 59, integer: true },
      true,
    ),
    '59',
  );
});
test('duration adjustment carries minutes, accepts signed inputs, and adjusts factors', () => {
  assert.equal(adjustValue('0:59:00', 2, { kind: 'auto' }), '1:01:00');
  assert.equal(adjustValue('0:00:30', -1, { kind: 'auto' }), '-0:00:30');
  assert.equal(adjustValue('-0:00:30', -1, { kind: 'auto' }, true), '-0:00:31');
  assert.equal(adjustValue('1.5', 2, { kind: 'auto' }, true), '1.7');
});
test('clock and calendar adjustment respects clock limits and leap days', () => {
  assert.equal(adjustValue('23:59', 10, { kind: 'time' }), '23:59:59');
  assert.equal(adjustValue('00:00', -1, { kind: 'time' }), '00:00');
  assert.equal(adjustValue('09:00', 1, { kind: 'time' }, true), '09:00:01');
  assert.equal(adjustValue('2028-02-28', 1, { kind: 'date' }), '2028-02-29');
  assert.equal(adjustValue('2028-02-29', 1, { kind: 'date' }), '2028-03-01');
});
test('blank and invalid inputs remain available for manual correction', () => {
  for (const value of ['', 'words', '1:99:00', 'Infinity'])
    assert.equal(adjustValue(value, 1, { kind: 'auto' }), null);
  assert.equal(adjustValue('2026-02-30', 1, { kind: 'date' }), null);
});
