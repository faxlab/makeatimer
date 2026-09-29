import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  remainingTime,
  pauseTimer,
  resumeTimer,
  validateTimer,
  intervalPosition,
  displayMilliseconds,
} from '../src/lib/timing';
import { encodeShare, decodeShare } from '../src/lib/share';
import { adController } from '../src/lib/ads';
import { tools } from '../src/lib/tools';
test('duration timing is independent of browser ticks and recovers missed deadlines', () => {
  const timer = {
    kind: 'duration' as const,
    total: 300000,
    remaining: 300000,
    end: 301000,
    status: 'running' as const,
    zone: 'UTC',
  };
  assert.equal(remainingTime(timer, 151000), 150000);
  assert.equal(remainingTime(timer, 600000), 0);
  const paused = pauseTimer(timer, 61000);
  assert.equal(paused.remaining, 240000);
  assert.equal(remainingTime(paused, 500000), 240000);
  const resumed = resumeTimer(paused, 500000);
  assert.equal(resumed.end, 740000);
  assert.equal(validateTimer(timer)?.kind, 'duration');
  assert.equal(validateTimer({ ...timer, total: Infinity }), null);
  assert.equal(
    pauseTimer({ ...timer, kind: 'deadline' }, 61000).status,
    'running',
  );
});
test('interval transitions, zero rests, completion and long suspension', () => {
  assert.deepEqual(intervalPosition(30000, 30000, 10000, 8), {
    phase: 'Rest',
    round: 1,
    remaining: 10000,
    complete: false,
  });
  assert.deepEqual(intervalPosition(40000, 30000, 10000, 8), {
    phase: 'Work',
    round: 2,
    remaining: 30000,
    complete: false,
  });
  assert.equal(intervalPosition(310000, 30000, 10000, 8).complete, true);
  assert.equal(intervalPosition(30000, 30000, 0, 2).round, 2);
  assert.equal(intervalPosition(1000000, 30000, 10000, 8).phase, 'Complete');
  assert.equal(displayMilliseconds(1001), '00:02');
  assert.equal(displayMilliseconds(1099, true), '00:01.09');
});
test('every calculator state round-trips with readable versioned parameters', () => {
  for (const tool of tools) {
    const values = Object.fromEntries(
      tool.fields.map((f) => [f.key, f.default]),
    );
    assert.deepEqual(decodeShare(encodeShare(values), values).values, values);
  }
  const deadline = {
    instant: '2026-12-01T12:00:00.000Z',
    zone: 'Europe/London',
    label: '<script>alert(1)</script> & lunch',
  };
  assert.deepEqual(
    decodeShare(encodeShare(deadline), deadline).values,
    deadline,
  );
});
test('malformed, duplicate, unknown and oversized link state restores defaults', () => {
  const defaults = { amount: '90' };
  for (const hash of [
    '#v=2&amount=1',
    '#v=1&amount=1&amount=2',
    '#v=1&surprise=hi',
    '#' + 'a'.repeat(12001),
  ]) {
    const decoded = decodeShare(hash, defaults);
    assert.deepEqual(decoded.values, defaults);
    assert(decoded.warning);
  }
});
test('ads never load disabled, before consent, or during timing', () => {
  const events: string[] = [];
  const env = {
    loadScript: () => events.push('load'),
    fill: (id: string) => events.push(id),
    clear: () => events.push('clear'),
    reload: () => events.push('reload'),
  };
  const off = adController(false, env);
  off.consent(true);
  off.visible('side');
  assert.deepEqual(events, []);
  const on = adController(true, env);
  on.visible('side');
  on.consent(false);
  assert.deepEqual(events, []);
  on.timing(true);
  on.consent(true);
  on.visible('side');
  assert.deepEqual(events, []);
  on.timing(false);
  on.visible('side');
  on.visible('side');
  assert.deepEqual(events, ['load', 'side']);
  on.consent(false);
  assert.deepEqual(events.slice(-2), ['clear', 'reload']);
});
