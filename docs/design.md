# Design rules

Makeatimer puts the task, its inputs, and its result first. Navigation stays in a predictable place, colour identifies a tool family, and typography carries the hierarchy.

The wayfinding reference is Massimo Vignelli and Bob Noorda's 1970 New York City Transit Authority graphics system. Its consistent signage and defined type/spacing system inform this interface's alignment, repetition, and clear destinations. See the [Standards Manual reissue](https://standardsmanual.com/products/nyctacompactedition), its [type specimen](https://standardsmanual.com/pages/type-specimen), and the [RIT Vignelli archive](https://www.rit.edu/news/vignelli-center-launches-digital-archives). The rules below are Makeatimer's own application of that reference.

## Typography and surfaces

- Preserve the compact lowercase `makeatimer.` wordmark and green dot.
- Use the existing system sans-serif stack without downloading fonts. Body text and inputs are 16px; supporting labels are at least 14px.
- Use bold, left-aligned headings and tabular numerals for time values. Reserve large numerals for the clock and primary result.
- Keep the header black with white lettering and neutral white/grey workspace surfaces. The workspace follows System by default, with explicit Light and Dark options saved locally.
- Use neutral panels, borders, and action buttons. Colour marks families, selected destinations, and result edges. Error and focus states retain their own semantics.
- Keep surfaces square and control corners subtle. Use an 8px spacing rhythm and avoid decorative shadows.

## Tool families

Family markers use round, lettered discs and the subway colours published in the [MTA colour dataset](https://data.ny.gov/d/3uhz-sej2), verified September 30, 2026. Letter and label colours preserve contrast in each theme. Every marker appears beside a readable family name. Current tool and filter states also have text, borders, and semantic attributes.

| Family        | Disc | Colour    | Light text accent | Dark text accent |
| ------------- | ---- | --------- | ----------------- | ---------------- |
| Timers        | T    | `#009952` | `#00763E`         | `#22C976`        |
| Time math     | M    | `#0062CF` | `#0053B0`         | `#78A9FF`        |
| Work          | W    | `#F6BC26` | `#765400`         | `#F6BC26`        |
| Dates         | D    | `#9A38A1` | `#9A38A1`         | `#DC68E3`        |
| Time zones    | Z    | `#D82233` | `#C51F2E`         | `#FF6773`        |
| Rates & media | R    | `#EB6800` | `#A54400`         | `#FF8930`        |

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

Numeric, duration, clock, and date fields support vertical mouse/pen dragging. Moving up increases the value; moving down decreases it. Shift refines the adjustment and Alt increases its step. Whole-number fields stay whole. Escape cancels a drag, bounds discard overshoot, and blank/invalid values remain available for typing. Duration text also supports Up/Down keys. Touch retains scrolling and native field editing; drag hints hide on coarse pointers. Respect reduced-motion preferences and keep fields stationary while values change.

Timing stays scoped to its original page and tab. While active or paused, internal navigation opens a new tab; the timing screen also offers a labelled link for this action. Opening another tab never clones or starts a timer. Fullscreen focuses on the clock and timing controls.

Timer/countdown addresses mirror their settings and current state. A copied running address contains an absolute finishing instant and opens immediately as a silent countdown. Setup duration links begin on opening; paused links retain remaining time; expired links show completion. A local draft survives refresh without starting itself. Shared opening never unlocks audio or requests wake lock. Calculator, stopwatch, and interval links remain editable presets. Copied links are snapshots rather than a synchronized remote session.

Calculation handoffs sit below the result actions. Frames to seconds offers **Estimate render time**, passing its frame count into Render time. Render time offers **Find finish time**, passing its displayed estimate into Start / finish. Both open editable versioned presets through an explicit link; neither starts timing. Reserve the action layout before the engine loads and disable the action for invalid or unsupported destination values. Generic related-tool links remain available in the guide.

## Reserved advertising

Keep advertising outside the controls. A side placement appears only from 1536px, with at least 800px left for the tool workspace. Smaller layouts use reserved result/content placements. Hide placements during active, paused, restored, or fullscreen timing and while a calculator shows an error.

Advertising is disabled by default. Enabling it requires the publisher and consent configuration described in [deployment instructions](deployment.md).

## Verification

`npm run browser-check` covers Chromium, Firefox, and WebKit, including value dragging, precision and cancellation, live/paused/expired countdown links, editable draft reloads, address updates with blocked storage, silent shared opening, family counts, current-tool navigation, favourites, theme persistence, keyboard menus, timer tab isolation, narrow layouts, and automated WCAG 2/2.1 AA checks. `npm run ad-check` exercises reserved placements and consent using stubbed ads. Review screenshots when changing layout; automated checks do not replace visual or physical-device review.
