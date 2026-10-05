import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyticsController,
  readAnalyticsChoice,
  ANALYTICS_STORAGE_KEY,
  ANALYTICS_LIFETIME,
} from '../src/lib/analytics';

function fixture(raw: string | null = null, enabled = true) {
  let now = 2000000000000;
  let loads = 0;
  let reloads = 0;
  let blocked = false;
  let scriptBlocked = false;
  const controller = analyticsController(enabled, {
    storage: {
      getItem() {
        if (blocked) throw Error('Storage blocked');
        return raw;
      },
      setItem(key, value) {
        assert.equal(key, ANALYTICS_STORAGE_KEY);
        if (blocked) throw Error('Storage blocked');
        raw = value;
      },
    },
    now: () => now,
    load: async () => {
      loads++;
      if (scriptBlocked) throw Error('Script blocked');
    },
    reload: () => {
      reloads++;
    },
    changed: () => {},
  });
  return {
    controller,
    counts: () => ({ loads, reloads }),
    raw: () => raw,
    external: (value: string | null) => {
      raw = value;
      controller.refresh();
    },
    advance: (ms: number) => {
      now += ms;
      controller.refresh();
    },
    blockStorage: () => {
      blocked = true;
    },
    blockScript: () => {
      scriptBlocked = true;
    },
  };
}
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));
const record = (choice: 'allowed' | 'denied', savedAt = 2000000000000) =>
  JSON.stringify({ version: 1, choice, savedAt });

test('unset and initial refusal never load statistics; refusal lasts 180 days', async () => {
  const f = fixture();
  f.controller.refresh();
  await settle();
  assert.deepEqual(f.counts(), { loads: 0, reloads: 0 });
  assert.equal(f.controller.choose('denied'), true);
  await settle();
  assert.equal(f.controller.state().choice, 'denied');
  assert.deepEqual(f.counts(), { loads: 0, reloads: 0 });
  f.advance(ANALYTICS_LIFETIME - 1);
  assert.equal(f.controller.state().choice, 'denied');
  f.advance(1);
  assert.equal(f.controller.state().choice, 'unset');
});
test('acceptance loads once despite repeated choice, refresh, or cross-tab events', async () => {
  const f = fixture();
  f.controller.choose('allowed');
  await settle();
  assert.equal(f.controller.state().script, 'loaded');
  f.controller.refresh();
  f.controller.choose('allowed');
  f.external(f.raw());
  await settle();
  assert.deepEqual(f.counts(), { loads: 1, reloads: 0 });
});
test('saved allowed choice loads; saved refusal does not', async () => {
  for (const choice of ['allowed', 'denied'] as const) {
    const f = fixture(record(choice));
    f.controller.refresh();
    await settle();
    assert.equal(f.controller.state().choice, choice);
    assert.equal(f.counts().loads, choice === 'allowed' ? 1 : 0);
  }
});
test('expired, corrupt, unsupported, and future choices fail closed', () => {
  for (const raw of [
    record('allowed', 2000000000000 - ANALYTICS_LIFETIME),
    record('allowed', 2000000000001),
    '{}',
    'invalid',
    '{"version":2,"choice":"allowed","savedAt":1}',
    null,
  ]) {
    assert.equal(readAnalyticsChoice(raw, 2000000000000), null);
    const f = fixture(raw);
    f.controller.refresh();
    assert.equal(f.counts().loads, 0);
  }
});
test('withdrawal saves refusal before reloading once', async () => {
  const f = fixture();
  f.controller.choose('allowed');
  await settle();
  f.controller.choose('denied');
  f.controller.refresh();
  assert.equal(JSON.parse(f.raw()!).choice, 'denied');
  assert.deepEqual(f.counts(), { loads: 1, reloads: 1 });
});
test('cross-tab allowance loads and cross-tab refusal, clearing, or expiry reloads', async () => {
  for (const change of ['denied', 'clear', 'expire']) {
    const f = fixture();
    f.controller.refresh();
    f.external(record('allowed'));
    await settle();
    if (change === 'expire') f.advance(ANALYTICS_LIFETIME);
    else f.external(change === 'clear' ? null : record('denied'));
    assert.deepEqual(f.counts(), { loads: 1, reloads: 1 });
  }
});
test('blocked storage prevents acceptance and loading, including a saved allowance', async () => {
  const f = fixture(record('allowed'));
  f.blockStorage();
  f.controller.refresh();
  assert.equal(f.controller.choose('allowed'), false);
  await settle();
  assert.equal(f.controller.state().storageError, true);
  assert.deepEqual(f.counts(), { loads: 0, reloads: 0 });
});
test('blocked beacon does not retry or affect saved permission', async () => {
  const f = fixture();
  f.blockScript();
  f.controller.choose('allowed');
  await settle();
  assert.equal(f.controller.state().script, 'blocked');
  f.controller.refresh();
  f.controller.choose('allowed');
  await settle();
  assert.deepEqual(f.counts(), { loads: 1, reloads: 0 });
});
test('withdrawal before queued injection prevents the script from loading', async () => {
  const f = fixture();
  f.controller.choose('allowed');
  f.controller.choose('denied');
  await settle();
  assert.deepEqual(f.counts(), { loads: 0, reloads: 1 });
});
test('disabled previews ignore saved permission and cannot load statistics', async () => {
  const f = fixture(record('allowed'), false);
  f.controller.refresh();
  assert.equal(f.controller.choose('allowed'), false);
  await settle();
  assert.deepEqual(f.counts(), { loads: 0, reloads: 0 });
});
