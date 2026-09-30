import test from 'node:test';
import assert from 'node:assert/strict';
import {
  consentState,
  googleConsentAdapter,
  type ConsentData,
  type ConsentHost,
  type ConsentState,
} from '../src/lib/consent';

type Callback = (data: ConsentData | undefined, success: boolean) => void;

const accepted: ConsentData = {
  cmpId: 300,
  cmpStatus: 'loaded',
  eventStatus: 'useractioncomplete',
  gdprApplies: true,
  tcString: 'fixture-only',
  purpose: { consents: { 1: true } },
  vendor: { consents: { 755: true } },
};
test('Google CMP gate requires a resolved state, storage and Google vendor consent', () => {
  assert.equal(consentState(accepted, true).permitted, true);
  for (const data of [
    undefined,
    {},
    { ...accepted, cmpId: 1 },
    { ...accepted, cmpStatus: 'error' },
    { ...accepted, gdprApplies: undefined },
    { ...accepted, tcString: '' },
    { ...accepted, eventStatus: 'cmpuishown' },
    { ...accepted, purpose: {} },
    { ...accepted, vendor: { consents: { 755: false } } },
  ])
    assert.equal(consentState(data, true).permitted, false);
  assert.equal(consentState(accepted, false).permitted, false);
  assert.equal(
    consentState({ ...accepted, eventStatus: 'tcloaded' }, true).permitted,
    true,
  );
  const outside = consentState(
    {
      cmpId: 300,
      cmpStatus: 'loaded',
      gdprApplies: false,
      eventStatus: 'tcloaded',
    },
    true,
  );
  assert.deepEqual(outside, {
    phase: 'resolved',
    permitted: true,
    canReopen: false,
  });
});
test('adapter subscribes once and ignores stale consent while preferences are reopened', () => {
  const queue: Record<string, () => void>[] = [];
  const states: ConsentState[] = [];
  let listener: (
    data: ConsentData | undefined,
    success: boolean,
  ) => void = () => {};
  let subscriptions = 0;
  let opened = 0;
  const host: ConsentHost = {
    googlefc: {
      callbackQueue: queue,
      showRevocationMessage: () => {
        opened++;
      },
    },
    __tcfapi: (command, version, callback) => {
      assert.equal(command, 'addEventListener');
      assert.equal(version, 2);
      subscriptions++;
      listener = callback;
      callback(accepted, true);
    },
  };
  const adapter = googleConsentAdapter(host, (state) => states.push(state));
  queue[0].CONSENT_API_READY();
  queue[0].CONSENT_API_READY();
  assert.equal(subscriptions, 1);
  assert.equal(states.at(-1)?.permitted, true);
  adapter.open();
  queue[1].CONSENT_API_READY();
  assert.equal(opened, 1);
  listener({ ...accepted, eventStatus: 'tcloaded' }, true);
  assert.equal(states.at(-1)?.phase, 'pending');
  listener({ ...accepted, purpose: { consents: { 1: false } } }, true);
  assert.deepEqual(states.at(-1), {
    phase: 'resolved',
    permitted: false,
    canReopen: true,
  });
  listener(accepted, true);
  assert.equal(states.at(-1)?.permitted, true);
  adapter.fail();
  assert.equal(states.at(-1)?.phase, 'unavailable');
});
test('missing or failed consent APIs keep advertising blocked', () => {
  for (const __tcfapi of [
    undefined,
    () => {
      throw new Error('blocked');
    },
  ]) {
    const queue: Record<string, () => void>[] = [];
    let state: ConsentState | undefined;
    const adapter = googleConsentAdapter(
      { googlefc: { callbackQueue: queue }, __tcfapi },
      (s) => {
        state = s;
      },
    );
    queue[0].CONSENT_API_READY();
    assert.equal(state?.permitted, false);
    assert.equal(state?.canReopen, false);
    adapter.open();
    assert.equal(queue.length, 1);
  }
});

test(
  'a silent CMP times out and a late valid response recovers',
  { timeout: 1000 },
  async () => {
    const queue: Record<string, () => void>[] = [];
    const states: ConsentState[] = [];
    let listener: Callback = () => {};
    let timedOut!: () => void;
    const timeout = new Promise<void>((resolve) => {
      timedOut = resolve;
    });
    googleConsentAdapter(
      {
        googlefc: { callbackQueue: queue },
        __tcfapi: (_command, _version, callback) => {
          listener = callback;
          callback(
            { ...accepted, eventStatus: 'tcloaded', tcString: '' },
            true,
          );
        },
      },
      (state) => {
        states.push(state);
        if (state.phase === 'unavailable') timedOut();
      },
      5,
    );
    queue[0].CONSENT_API_READY();
    await timeout;
    assert.deepEqual(states.at(-1), {
      phase: 'unavailable',
      permitted: false,
      canReopen: false,
    });
    listener(accepted, true);
    assert.equal(states.at(-1)?.permitted, true);
  },
);

test(
  'a displayed CMP has no deadline for the user decision',
  { timeout: 1000 },
  async () => {
    const queue: Record<string, () => void>[] = [];
    const states: ConsentState[] = [];
    const adapter = googleConsentAdapter(
      {
        googlefc: { callbackQueue: queue },
        __tcfapi: (_command, _version, callback) => {
          callback(
            { ...accepted, eventStatus: 'cmpuishown', tcString: '' },
            true,
          );
        },
      },
      (state) => states.push(state),
      5,
    );
    queue[0].CONSENT_API_READY();
    await new Promise((resolve) => setTimeout(resolve, 15));
    assert.equal(states.at(-1)?.phase, 'pending');
    assert.equal(states.at(-1)?.permitted, false);
    adapter.fail();
  },
);

test(
  'a failed preference reopen does not restore stale permission',
  { timeout: 1000 },
  async () => {
    const queue: Record<string, () => void>[] = [];
    let listener: Callback = () => {};
    let state: ConsentState | undefined;
    let timedOut!: () => void;
    const timeout = new Promise<void>((resolve) => {
      timedOut = resolve;
    });
    const adapter = googleConsentAdapter(
      {
        googlefc: { callbackQueue: queue, showRevocationMessage: () => {} },
        __tcfapi: (_command, _version, callback) => {
          listener = callback;
          callback(accepted, true);
        },
      },
      (next) => {
        state = next;
        if (next.phase === 'unavailable') timedOut();
      },
      5,
    );
    queue[0].CONSENT_API_READY();
    adapter.open();
    queue[1].CONSENT_API_READY();
    listener({ ...accepted, eventStatus: 'tcloaded' }, true);
    await timeout;
    assert.equal(state?.phase, 'unavailable');
    assert.equal(state?.permitted, false);
    listener({ ...accepted, eventStatus: 'tcloaded' }, true);
    assert.equal(state?.permitted, false);
    listener(accepted, true);
    assert.equal(state?.permitted, true);
  },
);
