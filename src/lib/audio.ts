export type Sound = 'bell' | 'beep' | 'silent';
let context: AudioContext | undefined;
export async function unlockAudio() {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    context ??= new AudioContext();
    // Some browsers leave resume() pending when audio output is unavailable.
    await Promise.race([
      context.resume(),
      new Promise<void>((resolve) => {
        timeout = setTimeout(resolve, 500);
      }),
    ]);
    return context.state === 'running';
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
export function playSound(sound: Sound) {
  if (sound === 'silent' || !context || context.state !== 'running') return;
  for (let i = 0; i < 3; i++) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = sound === 'bell' ? 880 : 660;
    const start = context.currentTime + i * 0.35;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.16, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.32);
  }
}
