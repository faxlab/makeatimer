# Design rules

Makeatimer puts the task, its inputs, and its result first. Navigation stays in a predictable place, colour identifies a tool family, and typography carries the hierarchy.

The wayfinding reference is Massimo Vignelli and Bob Noorda's 1970 New York City Transit Authority graphics system. Its consistent signage and defined type/spacing system inform this interface's alignment, repetition, and clear destinations. See the [Standards Manual reissue](https://standardsmanual.com/products/nyctacompactedition), its [type specimen](https://standardsmanual.com/pages/type-specimen), and the [RIT Vignelli archive](https://www.rit.edu/news/vignelli-center-launches-digital-archives). The rules below are Makeatimer's own application of that reference.

## Typography and surfaces

- Preserve the compact lowercase `makeatimer.` wordmark and green dot.
- Use the existing system sans-serif stack without downloading fonts. Body text and inputs are 16px; supporting labels are at least 14px.
- Use bold, left-aligned headings and tabular numerals for time values. Reserve large numerals for the clock and primary result.
- Keep the header charcoal with warm white lettering. The workspace follows System by default, with explicit Light and Dark options saved locally.
- Use neutral panels, borders, and action buttons. Colour marks families, selected destinations, and result edges. Error and focus states retain their own semantics.
- Keep surfaces square and control corners subtle. Use an 8px spacing rhythm and avoid decorative shadows.

## Tool families

Every coloured marker appears beside a readable family name. Current tool and filter states also have text, borders, and semantic attributes.

| Family        | Tools                                                             | Light accent | Dark accent |
| ------------- | ----------------------------------------------------------------- | ------------ | ----------- |
| Timers        | Timer, countdown, stopwatch, intervals                            | `#146C43`    | `#52B788`   |
| Time math     | Arithmetic, duration sums, clock differences, units, start/finish | `#2457B2`    | `#6FA8FF`   |
| Work          | Work hours, timesheet, decimal hours                              | `#825C00`    | `#F2BC57`   |
| Dates         | Date difference, offsets, business days, weekday, ISO week        | `#6941A5`    | `#B69CFF`   |
| Time zones    | Conversion, meeting overlap                                       | `#006B78`    | `#57C7D4`   |
| Rates & media | Playback, speech, running pace, rendering, frames                 | `#A4441F`    | `#F28C63`   |

`src/lib/families.ts` defines display names and accents. Each tool declares a typed `family` and a separate calculation `engine` in `src/lib/tools.ts`; regrouping navigation must preserve its calculation engine.

## Layout

- At 1100px and above, use a 224px tool rail with All tools, Favourites, and expandable families. Expand the current family and mark its tool with `aria-current`.
- Below 1100px, provide a labelled Tools button. It exposes the same navigation, reports its expanded state, and closes on Escape while returning focus.
- Use two grouped directory columns on desktop and one on phones. Search, family filters, favourites, and Clear filters work together.
- Start the homepage with Online timer, one purpose sentence, and the controls. Keep duration fields, presets, and Start within the initial 390px-wide phone screen.
- Place calculator inputs beside results from 1280px when the available workspace supports it; otherwise stack them. Keep desktop results visible while editing long forms.
- Align timesheet days and fields into rows when the input panel is wide enough. On small screens, show labelled day groups. Keep the total and CSV action easy to find.
- Keep narrow layouts free of page-level horizontal scrolling. Wide result tables scroll within a labelled, keyboard-focusable region and preserve readable time ranges.

## Interaction

Use native buttons, fields, select elements, and expandable navigation. Controls have at least 44px touch targets and a visible focus ring. Select fields keep native keyboard behaviour with a consistent visual arrow.

Timing stays scoped to its original page and tab. While active or paused, internal navigation opens a new tab; the timing screen also offers a labelled link for this action. Opening another tab never clones or starts a timer. Fullscreen focuses on the clock and timing controls.

## Reserved advertising

Keep advertising outside the controls. A side placement appears only from 1536px, with at least 800px left for the tool workspace. Smaller layouts use reserved result/content placements. Hide placements during active, paused, restored, or fullscreen timing and while a calculator shows an error.

Advertising is disabled by default. Enabling it requires the publisher and consent configuration described in [deployment instructions](deployment.md).

## Verification

`npm run browser-check` covers Chromium, Firefox, and WebKit, including family counts, current-tool navigation, favourites, theme persistence, keyboard menus, timer tab isolation, narrow layouts, and automated WCAG 2/2.1 AA checks. `npm run ad-check` exercises reserved placements and consent using stubbed ads. Review screenshots when changing layout; automated checks do not replace visual or physical-device review.
