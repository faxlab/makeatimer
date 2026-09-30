import { test } from 'node:test';
import assert from 'node:assert/strict';
import { timerLinkValues, timerFromLink } from '../src/lib/timer-sharing';
import { encodeShare, decodeShare } from '../src/lib/share';
import { remainingTime, pauseTimer, resumeTimer } from '../src/lib/timing';
const now = Date.UTC(2026, 8, 30, 12);
const inputs = {
  mode: 'duration',
  hours: '0',
  minutes: '5',
  seconds: '0',
  time: '17:00',
  date: '',
  zone: 'UTC',
  choice: 'reject',
  label: '',
  instant: '',
  state: 'setup',
  remaining: '',
};

test('running timer addresses retain one absolute finish time across visitors', () => {
  const timer = timerFromLink(inputs, now);
  const values = timerLinkValues(inputs, timer);
  const decoded = decodeShare(encodeShare(values), inputs);
  assert.equal(decoded.warning, '');
  const end = Date.parse(decoded.values.instant);
  const visitor = timerFromLink(decoded.values, now + 60000, end);
  assert.equal(visitor.end, timer.end);
  assert.equal(remainingTime(visitor, now + 60000), 240000);
  assert.equal(visitor.status, 'running');
});
test('setup links begin a duration on opening and omit irrelevant fields', () => {
  const values = timerLinkValues(inputs, null);
  assert(!('instant' in values));
  assert(!('time' in values));
  assert.equal(timerFromLink(values, now).end, now + 300000);
});
test('paused links keep remaining time and resumed links get their new finish time', () => {
  const paused = pauseTimer(timerFromLink(inputs, now), now + 60000);
  const values = timerLinkValues(inputs, paused);
  const visitor = timerFromLink(values, now + 600000);
  assert.equal(visitor.status, 'paused');
  assert.equal(visitor.remaining, 240000);
  const resumed = resumeTimer(paused, now + 600000);
  assert.equal(
    Date.parse(timerLinkValues(inputs, resumed).instant),
    now + 840000,
  );
});
test('expired shared timers finish immediately and malformed state never starts', () => {
  const values = timerLinkValues(inputs, timerFromLink(inputs, now));
  assert.equal(
    timerFromLink(values, now + 400000, Date.parse(values.instant)).status,
    'finished',
  );
  for (const bad of [
    { minutes: '60' },
    { state: 'surprise' },
    { state: 'paused', remaining: '9999999' },
    { instant: 'bad' },
  ])
    assert.throws(() => timerFromLink({ ...inputs, ...bad }, now));
});
