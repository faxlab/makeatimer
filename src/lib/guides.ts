// These guides are rendered by Astro. Keep them out of hydrated tool props.
export type ToolGuide = {
  steps: string[];
  formula: string;
  explanation: string;
  examples: { title: string; text: string }[];
  table: { caption: string; headers: string[]; rows: string[][] };
  faqs: { question: string; answer: string }[];
  connections: { id: string; text: string }[];
};

export const guides: Record<string, ToolGuide> = {
  'render-time': {
    steps: [
      'Enter the number of frames still to render. For a partially finished job, use the remaining frames.',
      'Enter seconds per frame from a test render using the settings and hardware you intend to use.',
      'Enter the number of equally capable workers that can render separate frames at the same time. Use 1 for a single worker.',
      'Add a percentage allowance for scheduling, transfers, and other overhead. Review the result as an estimate.',
    ],
    formula:
      'Estimated seconds = ceil(frames ÷ workers) × seconds per frame × (1 + overhead ÷ 100)',
    explanation:
      'A batch gives each available worker one frame. The number of batches is rounded up because a remaining frame still needs a full per-frame render interval. The overhead allowance increases the complete estimate; it is not a separate fixed setup time.',
    examples: [
      {
        title: 'A measured Blender render on one worker',
        text: 'With frames 1–240 inclusive and frame step 1, Blender renders 240 frames. If representative test frames take 45 seconds each on your intended hardware, one worker needs 240 × 45 = 10,800 seconds. Adding 10% overhead gives 11,880 seconds: 3 hours 18 minutes. This is an estimate; complex frames or loading delays can change the actual time.',
      },
      {
        title: 'A short animation on four workers',
        text: '240 frames at 30 seconds per frame need 60 batches on four equal workers. That is 1,800 seconds, or 30 minutes. Adding 10% overhead gives 1,980 seconds: 33 minutes.',
      },
      {
        title: 'An incomplete final batch',
        text: 'Ten frames on three equal workers need four batches, not 3.33. At 30 seconds per frame and 0% overhead, the estimate is 120 seconds, or two minutes. Only one worker has a frame in the final batch.',
      },
    ],
    table: {
      caption: '240 frames at 30 seconds per frame, including 10% overhead',
      headers: ['Workers', 'Frame batches', 'Duration (H:MM:SS)'],
      rows: [
        ['1', '240', '2:12:00'],
        ['2', '120', '1:06:00'],
        ['4', '60', '0:33:00'],
        ['8', '30', '0:16:30'],
      ],
    },
    faqs: [
      {
        question: 'How should I measure seconds per frame?',
        answer:
          'Test several representative frames, including a complex part of the sequence. Use the intended resolution, samples, scene, and hardware. Try typical and slower measured values in the calculator to see how the estimate changes. A single unusually simple frame can underestimate the job.',
      },
      {
        question: 'Will twice as many workers finish in half the time?',
        answer:
          'The calculation assumes equal workers rendering independent frames with ideal distribution. Different hardware, shared resources, uneven frame complexity, or loading delays can change the actual completion time. Small jobs also have a partially filled final batch. Choose an overhead allowance based on your workflow.',
      },
      {
        question: 'Does this estimate the price of a render farm?',
        answer:
          'This result estimates elapsed render time. A cost quote also needs the provider’s pricing and billing rules. It does not benchmark your scene or account for a provider’s queue.',
      },
    ],
    connections: [
      {
        id: 'frames-duration',
        text: 'Check how long your animation will play at its frame rate.',
      },
      {
        id: 'start-finish',
        text: 'Use the estimated duration to plan a finish time.',
      },
    ],
  },
  'frames-duration': {
    steps: [
      'Enter the total frame count of the clip, animation, or sequence.',
      'Choose an FPS preset or type the frame rate from your project or clip settings.',
      'Read the elapsed duration and the equivalent number of seconds. Custom decimal frame rates are accepted.',
    ],
    formula: 'Duration in seconds = frame count ÷ frames per second',
    explanation:
      'FPS tells you how many frames play in one second. Divide by FPS to find the elapsed time, then divide seconds by 60 for minutes or by 3,600 for hours. The main result uses hours:minutes:seconds, with fractional seconds where needed.',
    examples: [
      {
        title: 'Blender frames 1–240 at 24 FPS',
        text: 'Blender’s start and end frames are inclusive. With start frame 1, end frame 240, and frame step 1, the sequence contains 240 − 1 + 1 = 240 frames. At 24 FPS, 240 ÷ 24 = 10 seconds. Enter the frame count, 240, rather than subtracting the endpoints to get 239.',
      },
      {
        title: 'A 2,400-frame animation',
        text: 'At 24 FPS, 2,400 ÷ 24 = 100 seconds, or 1 minute 40 seconds. At 30 FPS, the same frame count lasts 80 seconds, or 1 minute 20 seconds.',
      },
      {
        title: 'A short clip',
        text: '300 frames at 30 FPS last 10 seconds. A one-minute sequence at 24 FPS contains 1,440 frames, so entering 1,440 and 24 returns one minute.',
      },
    ],
    table: {
      caption: 'Elapsed time for 2,400 frames at different frame rates',
      headers: ['FPS', 'Seconds', 'Duration (H:MM:SS)'],
      rows: [
        ['24', '100', '0:01:40'],
        ['25', '96', '0:01:36'],
        ['30', '80', '0:01:20'],
        ['60', '40', '0:00:40'],
      ],
    },
    faqs: [
      {
        question: 'Which frame rate should I enter?',
        answer:
          'Use the rate at which your sequence will play, as shown in the project or clip settings. The calculator does not inspect a media file. Changing this field calculates the duration for the new rate; it does not convert or retime your video.',
      },
      {
        question: 'Can I use 23.976, 29.97, or another decimal FPS?',
        answer:
          'Yes. Each preset uses the decimal value printed on its button, and custom values are used as entered. If your workflow specifies a more precise decimal rate, enter that value. Results are rounded for display: the main duration has up to six fractional-second places. A decimal preset is not an exact rational-rate or timecode conversion.',
      },
      {
        question: 'Is this the same as SMPTE or drop-frame timecode?',
        answer:
          'This tool converts a total frame count into elapsed time. SMPTE timecode uses hours, minutes, seconds, and frame labels; drop-frame numbering needs its own rules. A timecode label cannot be entered as a frame count here.',
      },
    ],
    connections: [
      {
        id: 'render-time',
        text: 'Estimate the time needed to render this frame count.',
      },
      {
        id: 'playback-speed',
        text: 'Use the duration to calculate viewing time at a different playback speed.',
      },
    ],
  },
  'playback-speed': {
    steps: [
      'Enter the original recording length as H:MM or H:MM:SS. For example, 0:30:00 means thirty minutes.',
      'Choose a speed preset or enter the multiplier used by your player. 1× is normal speed; 1.5× is one and a half times normal speed.',
      'Read the playback duration and the time saved or added compared with normal playback. Copy the result or share the editable inputs.',
    ],
    formula:
      'Playback duration = original duration ÷ speed; time saved = original duration − playback duration',
    explanation:
      'Playback speed scales the recording’s duration inversely. When the speed is below 1×, the result shows the extra time instead of a negative saving. The estimate assumes continuous playback. Pauses, advertisements, seeking, and other interruptions are not included.',
    examples: [
      {
        title: 'An eight-hour audiobook at 1.25×',
        text: '8 hours ÷ 1.25 = 6.4 hours, or 6 hours 24 minutes. Compared with normal playback, that saves 1 hour 36 minutes. Decimal hours use fractions of an hour: 0.4 hours is 24 minutes.',
      },
      {
        title: 'A ninety-minute lecture at 1.5×',
        text: '90 minutes ÷ 1.5 = 60 minutes, saving 30 minutes. At 0.75×, the same lecture takes 120 minutes, adding 30 minutes.',
      },
    ],
    table: {
      caption: 'Playback time for a one-hour recording',
      headers: ['Speed', 'Duration (H:MM:SS)', 'Saved or added'],
      rows: [
        ['0.75×', '1:20:00', '20 minutes extra'],
        ['1×', '1:00:00', '0 minutes saved'],
        ['1.25×', '0:48:00', '12 minutes saved'],
        ['1.5×', '0:40:00', '20 minutes saved'],
        ['2×', '0:30:00', '30 minutes saved'],
      ],
    },
    faqs: [
      {
        question: 'How long does a one-hour video take at 1.5×?',
        answer:
          'It takes 40 minutes and saves 20 minutes, assuming uninterrupted playback. Divide 60 by 1.5 to get 40; subtract 40 from the original 60 to get the saving.',
      },
      {
        question: 'Does 1.5× speed save 50% of the time?',
        answer:
          '1.5× means playback is 50% faster, but the duration is divided by 1.5. You spend two-thirds of the original time, saving one-third, or about 33.3%. At 2× speed, the duration is halved.',
      },
      {
        question: 'Can I calculate the remaining audiobook or playlist time?',
        answer:
          'Enter the remaining duration instead of the full recording length. For several items, total their lengths with Sum durations first, then use that total here. Add your own allowance for breaks or other interruptions.',
      },
    ],
    connections: [
      {
        id: 'sum-durations',
        text: 'Total a playlist or several chapters before choosing a playback speed.',
      },
      {
        id: 'frames-duration',
        text: 'Find the original clip duration from a frame count and FPS.',
      },
    ],
  },
};
