import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unlockAudio, playSound } from '../src/lib/audio';

test('unavailable audio never blocks forever or plays on a suspended context', async () => {
  const original = globalThis.AudioContext;
  let resumed = false;
  class SuspendedAudio {
    state = 'suspended';
    resume() {
      resumed = true;
      return new Promise<void>(() => {});
    }
    createOscillator() {
      throw new Error('Must not play before audio runs');
    }
  }
  globalThis.AudioContext = SuspendedAudio as unknown as typeof AudioContext;
  try {
    const available = await Promise.race([
      unlockAudio(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('Audio startup did not return')),
          2000,
        ),
      ),
    ]);
    assert(resumed);
    assert.equal(available, false);
    assert.doesNotThrow(() => playSound('bell'));
  } finally {
    globalThis.AudioContext = original;
  }
});
