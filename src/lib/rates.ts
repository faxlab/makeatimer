import { number, positiveDuration, formatDuration, decimal } from './duration';
import type { Values, Result } from './types';
export function calculate(id: string, v: Values): Result {
  switch (id) {
    case 'playback-speed': {
      const speed = number(v.speed, 'Playback speed', 0.01, 100);
      const s = positiveDuration(v.duration).div(speed);
      return {
        value: formatDuration(s),
        detail: `${v.speed}× playback · ${decimal(s.div(60))} minutes`,
      };
    }
    case 'speech-duration': {
      const words = number(v.words, 'Word count', 0);
      const wpm = number(v.wpm, 'Words per minute', 1, 1000);
      const pause = number(v.pause, 'Extra pauses in seconds', 0);
      const s = words.div(wpm).mul(60).add(pause);
      return {
        value: formatDuration(s),
        detail: `Estimate at ${v.wpm} words/minute plus ${v.pause} seconds of pauses.`,
      };
    }
    case 'running-pace': {
      const d = number(v.distance, 'Distance', 0.001);
      if (!['km', 'mi'].includes(v.unit))
        throw new Error('Choose kilometres or miles.');
      const s = positiveDuration(v.duration);
      if (s.isZero()) throw new Error('Time must be greater than zero.');
      return {
        value: `${formatDuration(s.div(d))} / ${v.unit}`,
        detail: `${decimal(d.div(s).mul(3600))} ${v.unit}/h · average pace over the whole distance`,
      };
    }
    case 'render-time': {
      const frames = number(v.frames, 'Frames', 1, 1e9);
      const workers = number(v.workers, 'Workers', 1, 10000);
      if (!frames.isInteger() || !workers.isInteger())
        throw new Error('Frames and workers must be whole numbers.');
      const frame = number(v.seconds, 'Seconds per frame', 0.001);
      const overhead = number(v.overhead, 'Overhead percent', 0, 1000);
      const s = frames
        .div(workers)
        .ceil()
        .mul(frame)
        .mul(overhead.div(100).add(1));
      return {
        value: formatDuration(s),
        detail: `${frames.div(workers).ceil()} frame batches · equal workers, ideal distribution, ${v.overhead}% overhead`,
      };
    }
    case 'frames-duration': {
      const frames = number(v.frames, 'Frames', 0);
      if (!frames.isInteger())
        throw new Error('Frame count must be a whole number.');
      const fps = number(v.fps, 'Frames per second', 0.001, 100000);
      const s = frames.div(fps);
      return {
        value: formatDuration(s, 6),
        detail: `${decimal(s)} seconds at ${v.fps} fps. No SMPTE or drop-frame timecode.`,
      };
    }
    default:
      throw new Error('Unknown rate calculator.');
  }
}
