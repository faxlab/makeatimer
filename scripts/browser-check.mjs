import { chromium, firefox, webkit } from 'playwright';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';
import { staticServer } from './static-server.mjs';
const { server, origin } = await staticServer('dist');
await mkdir('output/playwright', { recursive: true });
const reference = {
  'time-calculator': '2:15:00',
  'sum-durations': '2:30:00',
  'time-between': '8:30:00',
  'work-hours': '8:00:00',
  timesheet: '37.5 hours',
  'decimal-hours': '1.5 hours',
  'time-units': '1.5 hours',
  'start-finish': '10:30:00',
  'date-difference': '365 days',
  'add-dates': '2026-02-28',
  'business-days': '5 business days',
  weekday: 'Tuesday',
  'iso-week': '2020-W53',
  'time-zone': '2026-01-15 14:00:00 (Europe/London, UTC+00:00)',
  'meeting-planner': '6 half-hour meeting slots',
  'playback-speed': '0:40:00',
  'speech-duration': '0:05:06.923',
  'running-pace': '0:05:00 / km',
  'render-time': '0:33:00',
  'frames-duration': '0:01:40',
};
async function hydrated(page) {
  await page.waitForFunction(() => {
    const island = document.querySelector('astro-island');
    return island && !island.hasAttribute('ssr');
  });
}
async function ready(page) {
  await hydrated(page);
  await page.waitForFunction(
    () => !document.querySelector('.actions button')?.disabled,
  );
}
async function noOverflow(page) {
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    `Horizontal overflow at ${page.url()} (${JSON.stringify(page.viewportSize())})`,
  );
}
async function wayfinding(page, context, name) {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(`${origin}/time-zone/`);
  await ready(page);
  const navigation = page.getByRole('navigation', {
    name: 'Time tools',
    exact: true,
  });
  assert.equal(
    await navigation.locator('a[aria-current="page"]').innerText(),
    'Time zone converter',
  );
  assert.equal(
    await navigation.locator('details[open] summary').innerText(),
    'Time zones\n2',
  );
  await page.goto(`${origin}/tools/`);
  await hydrated(page);
  assert.equal(await page.locator('.directory-family').count(), 6);
  for (const [family, count] of [
    ['Timers', 4],
    ['Time math', 5],
    ['Work', 3],
    ['Dates', 5],
    ['Time zones', 2],
    ['Rates & media', 5],
  ]) {
    await page.getByRole('button', { name: family, exact: true }).click();
    assert.equal(
      await page.locator('.tool-tile').count(),
      count,
      `${name} ${family}`,
    );
  }
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await page.getByLabel('Theme', { exact: true }).selectOption('dark');
  await page.reload();
  await hydrated(page);
  assert.equal(
    await page.getByLabel('Theme', { exact: true }).inputValue(),
    'dark',
  );
  assert.equal(
    await page.evaluate(() => getComputedStyle(document.body).backgroundColor),
    'rgb(16, 16, 16)',
  );
  for (const route of ['tools/', '', 'timesheet/']) {
    await page.goto(`${origin}/${route}`);
    await ready(page);
    const audit = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    assert.deepEqual(
      audit.violations.map((violation) => violation.id),
      [],
      `${name} dark ${route} accessibility`,
    );
  }
  await page.getByLabel('Theme', { exact: true }).selectOption('light');
  await page.goto(`${origin}/time-calculator/`);
  await ready(page);
  assert.equal(
    await page.getByLabel('Theme', { exact: true }).inputValue(),
    'light',
  );
  assert.equal(
    await page.evaluate(() => getComputedStyle(document.body).backgroundColor),
    'rgb(243, 243, 243)',
  );
  await page.screenshot({
    path: `output/playwright/${name}-calculator.png`,
    fullPage: true,
  });
  await page.goto(`${origin}/timesheet/`);
  await ready(page);
  await page.screenshot({
    path: `output/playwright/${name}-timesheet.png`,
    fullPage: true,
  });
  await page.goto(`${origin}/tools/`);
  await hydrated(page);
  await page.screenshot({
    path: `output/playwright/${name}-directory.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin);
  await ready(page);
  const start = await page
    .getByRole('button', { name: 'Start timer', exact: true })
    .boundingBox();
  assert(
    start && start.y >= 0 && start.y + start.height <= 844,
    `${name} Start is on the first mobile screen`,
  );
  const menu = page.getByRole('button', { name: 'Tools 24', exact: true });
  await menu.focus();
  await menu.press('Enter');
  assert.equal(await menu.getAttribute('aria-expanded'), 'true');
  assert.equal(await navigation.isVisible(), true);
  await menu.press('Escape');
  assert.equal(await menu.getAttribute('aria-expanded'), 'false');
  assert.equal(
    await menu.evaluate((element) => element === document.activeElement),
    true,
  );
  assert.equal(await navigation.isVisible(), false);
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.getByLabel('Minutes', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Start timer', exact: true }).click();
  await page.waitForSelector('.timer-display');
  const newPage = context.waitForEvent('page');
  await page
    .getByRole('link', { name: 'Open another tool in a new tab', exact: false })
    .click();
  const other = await newPage;
  await hydrated(other);
  assert.equal(await other.locator('.tool-tile').count(), 24);
  await other.goto(origin);
  await ready(other);
  assert.equal(
    await other.locator('.timer-display').count(),
    0,
    `${name} a new tab never duplicates timing`,
  );
  assert.equal(
    await page.locator('.timer-display').count(),
    1,
    `${name} original timer remains available`,
  );
  assert.equal(
    await page.getByRole('button', { name: 'Pause', exact: true }).isVisible(),
    true,
  );
  await other.close();
  await page.getByRole('button', { name: 'Stop / edit', exact: true }).click();
  await page.getByLabel('Theme', { exact: true }).selectOption('system');
  console.log(
    `${name}: six families, current-tool navigation, dark/light contrast, saved theme, first-screen Start, keyboard menu and isolated new timing tabs passed.`,
  );
}
async function refinements(page, context, name) {
  await page.setViewportSize({ width: 1366, height: 900 });
  async function drag(locator, distance, modifier) {
    const box = await locator.boundingBox();
    assert(box);
    const x = box.x + box.width * 0.4,
      y = box.y + box.height / 2;
    if (modifier) await page.keyboard.down(modifier);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y - distance, { steps: 8 });
    await page.mouse.up();
    if (modifier) await page.keyboard.up(modifier);
  }
  await page.goto(`${origin}/time-calculator/`);
  await ready(page);
  const duration = page.getByLabel('First duration', { exact: true });
  await drag(duration, 80);
  assert.equal(await duration.inputValue(), '1:40:00');
  assert.equal(await page.locator('.result-value').innerText(), '2:25:00');
  const box = await duration.boundingBox();
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height / 2 - 24);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  assert.equal(await duration.inputValue(), '1:40:00');
  assert.equal(await page.locator('body.value-dragging').count(), 0);
  await duration.press('ArrowUp');
  assert.equal(await duration.inputValue(), '1:41:00');
  await page.goto(`${origin}/playback-speed/`);
  await ready(page);
  await drag(page.getByLabel('Playback multiplier', { exact: true }), 80, 'Shift');
  assert.equal(
    await page.getByLabel('Playback multiplier', { exact: true }).inputValue(),
    '1.6',
  );
  assert.equal(await page.locator('.result-value').innerText(), '0:37:30');
  await page.goto(`${origin}/time-between/`);
  await ready(page);
  await drag(page.getByLabel('Start time', { exact: true }), 16);
  assert.match(
    await page.getByLabel('Start time', { exact: true }).inputValue(),
    /^09:02/,
  );
  await page.goto(origin);
  await ready(page);
  await page.getByLabel('Minutes', { exact: true }).fill('2');
  await page.waitForFunction(
    () => new URLSearchParams(location.hash.slice(1)).get('minutes') === '2',
  );
  const setupAddress = page.url();
  await page.reload();
  await ready(page);
  assert.equal(
    await page.locator('.timer-display').count(),
    0,
    `${name} setup reload stays editable`,
  );
  assert.equal(
    await page.getByLabel('Minutes', { exact: true }).inputValue(),
    '2',
  );
  await page.getByRole('button', { name: 'Start timer', exact: true }).click();
  await page.waitForSelector('.timer-display');
  await page.waitForFunction(
    () =>
      new URLSearchParams(location.hash.slice(1)).get('state') === 'running',
  );
  const address = page.url();
  const instant = new URLSearchParams(new URL(address).hash.slice(1)).get(
    'instant',
  );
  assert(instant);
  const visitor = await context.newPage();
  await visitor.addInitScript(() => {
    window.__automaticAudio = 0;
    window.__automaticWake = 0;
    const Audio =
      window.AudioContext || Reflect.get(window, 'webkitAudioContext');
    if (Audio) {
      const resume = Audio.prototype.resume;
      Audio.prototype.resume = function (...args) {
        window.__automaticAudio++;
        return resume.apply(this, args);
      };
    }
    if (navigator.wakeLock) {
      const request = navigator.wakeLock.request.bind(navigator.wakeLock);
      navigator.wakeLock.request = (...args) => {
        window.__automaticWake++;
        return request(...args);
      };
    }
  });
  await visitor.goto(address);
  await ready(visitor);
  await visitor.waitForSelector('.timer-display');
  assert.equal(
    await visitor
      .getByRole('button', { name: 'Start timer', exact: true })
      .count(),
    0,
  );
  assert.equal(
    new URLSearchParams(new URL(visitor.url()).hash.slice(1)).get('instant'),
    instant,
  );
  assert.deepEqual(
    await visitor.evaluate(() => [
      window.__automaticAudio,
      window.__automaticWake,
    ]),
    [0, 0],
  );
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.waitForFunction(
    () => new URLSearchParams(location.hash.slice(1)).get('state') === 'paused',
  );
  await visitor.goto(page.url());
  await ready(visitor);
  assert.equal(
    await visitor
      .getByRole('button', { name: 'Resume', exact: true })
      .isVisible(),
    true,
  );
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page
    .getByRole('link', { name: 'Skip to content', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('.timer-display').count(), 1);
  assert.equal(
    new URLSearchParams(new URL(page.url()).hash.slice(1)).get('state'),
    'running',
  );
  const expired = new URL(address);
  const params = new URLSearchParams(expired.hash.slice(1));
  params.set('instant', '2026-01-01T00:00:00.000Z');
  expired.hash = params.toString();
  await visitor.goto(expired.href);
  await ready(visitor);
  await visitor.waitForSelector('.notice');
  assert.equal(await visitor.locator('.timer-display').innerText(), '00:00');
  assert.deepEqual(
    await visitor.evaluate(() => [
      window.__automaticAudio,
      window.__automaticWake,
    ]),
    [0, 0],
  );
  await visitor.goto(setupAddress);
  await ready(visitor);
  await visitor.waitForSelector('.timer-display');
  assert.equal(
    await visitor
      .getByRole('button', { name: 'Pause', exact: true })
      .isVisible(),
    true,
  );
  await visitor.close();
  await page.getByRole('button', { name: 'Stop / edit', exact: true }).click();
  const noStorage = await context.newPage();
  await noStorage.addInitScript(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (...args) {
      if (this === window.sessionStorage)
        throw new DOMException('Storage blocked', 'SecurityError');
      return setItem.apply(this, args);
    };
  });
  await noStorage.goto(origin);
  await ready(noStorage);
  for (const minutes of ['3', '4']) {
    await noStorage.getByLabel('Minutes', { exact: true }).fill(minutes);
    await noStorage.waitForFunction(
      (value) =>
        new URLSearchParams(location.hash.slice(1)).get('minutes') === value,
      minutes,
    );
  }
  await noStorage
    .getByRole('button', { name: 'Start timer', exact: true })
    .click();
  await noStorage.waitForFunction(
    () =>
      new URLSearchParams(location.hash.slice(1)).get('state') === 'running',
  );
  await noStorage.close();
  console.log(
    `${name}: drag adjustment, precision, Escape, keyboard, address-bar sharing (including blocked storage), live/paused/expired links, silent opening, and editable setup reload passed.`,
  );
}

async function mediaGuides(page, context, name) {
  await page.goto(`${origin}/playback-speed/`);
  await ready(page);
  const speed = page.getByLabel('Playback multiplier', { exact: true });
  const playbackPresets = page.getByRole('group', {
    name: 'Playback multiplier presets',
    exact: true,
  });
  for (const [preset, duration, label, difference] of [
    ['1.25×', '0:48:00', 'Time saved', '0:12:00'],
    ['0.75×', '1:20:00', 'Extra time', '0:20:00'],
    ['1×', '1:00:00', 'Time saved', '0:00:00'],
    ['2×', '0:30:00', 'Time saved', '0:30:00'],
  ]) {
    const button = playbackPresets.getByRole('button', {
      name: preset,
      exact: true,
    });
    await button.click();
    await page.waitForFunction(
      (expected) =>
        document.querySelector('.result-value')?.textContent === expected,
      duration,
    );
    assert.equal(await button.getAttribute('aria-pressed'), 'true');
    assert.equal(
      await page.locator('.result-panel tbody th').innerText(),
      label,
    );
    assert.equal(
      await page.locator('.result-panel tbody td').innerText(),
      difference,
    );
    assert.equal(await speed.evaluate((input) => input.validity.valid), true);
  }
  await speed.fill('1.5000');
  assert.equal(
    await playbackPresets
      .getByRole('button', { name: '1.5×', exact: true })
      .getAttribute('aria-pressed'),
    'true',
  );
  await speed.fill('1.3333');
  assert.equal(
    await playbackPresets.locator('[aria-pressed="true"]').count(),
    0,
  );
  await speed.fill('1.5');
  await speed.press('ArrowUp');
  assert.equal(await speed.inputValue(), '1.6');
  await speed.press('Shift+ArrowDown');
  assert.equal(await speed.inputValue(), '1.59');
  const quarter = playbackPresets.getByRole('button', {
    name: '1.25×',
    exact: true,
  });
  await quarter.focus();
  await quarter.press('Enter');
  assert.equal(await speed.inputValue(), '1.25');
  await page.evaluate(() => {
    window.copiedMediaResult = '';
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.copiedMediaResult = text;
        },
      },
    });
  });
  await page.getByRole('button', { name: 'Copy result', exact: true }).click();
  await page.waitForFunction(() =>
    window.copiedMediaResult.includes('Time saved: 0:12:00'),
  );
  await page.getByRole('button', { name: 'Share link' }).click();
  const sharedPlayback = await page
    .getByLabel('Share link', { exact: true })
    .inputValue();
  assert(
    sharedPlayback.includes('speed=1.25') && sharedPlayback.includes('v=1'),
  );
  await page.goto(sharedPlayback);
  await ready(page);
  await page.reload();
  await ready(page);
  assert.equal(await speed.inputValue(), '1.25');
  assert.equal(
    await page.locator('.result-panel tbody td').innerText(),
    '0:12:00',
  );
  await speed.fill('');
  await page.waitForSelector('.error');
  await playbackPresets
    .getByRole('button', { name: '1.5×', exact: true })
    .click();
  await page.waitForSelector('.result-value');
  await page.getByLabel('Original duration', { exact: true }).fill('');
  await playbackPresets
    .getByRole('button', { name: '2×', exact: true })
    .click();
  assert.equal(
    await page.getByLabel('Original duration', { exact: true }).inputValue(),
    '',
  );
  assert.equal(await page.locator('.error').count(), 1);

  await page.goto(`${origin}/frames-duration/`);
  await ready(page);
  const fps = page.getByLabel('Frames per second', { exact: true });
  const fpsPresets = page.getByRole('group', {
    name: 'Frames per second presets',
    exact: true,
  });
  await fpsPresets.getByRole('button', { name: '23.976', exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelector('.result-value')?.textContent === '0:01:40.1001',
  );
  assert.equal(await fps.evaluate((input) => input.validity.valid), true);
  await fps.fill('29.97002997');
  assert.equal(await fps.evaluate((input) => input.validity.valid), true);
  assert.equal(await fpsPresets.locator('[aria-pressed="true"]').count(), 0);
  await fps.fill('0');
  await page.waitForSelector('.error');
  await fpsPresets.getByRole('button', { name: '30', exact: true }).click();
  await page.waitForSelector('.result-value');
  assert.equal(
    await page.getByLabel('Frame count', { exact: true }).inputValue(),
    '2400',
  );
  await page.getByRole('button', { name: 'Share link' }).click();
  const sharedFrames = await page
    .getByLabel('Share link', { exact: true })
    .inputValue();
  await page.goto(sharedFrames);
  await ready(page);
  await page.reload();
  await ready(page);
  assert.equal(await fps.inputValue(), '30');
  assert.equal(await page.locator('.result-value').innerText(), '0:01:20');

  for (const theme of ['light', 'dark']) {
    await page.getByLabel('Theme', { exact: true }).selectOption(theme);
    for (const route of ['render-time', 'frames-duration', 'playback-speed']) {
      await page.goto(`${origin}/${route}/`);
      await ready(page);
      const guide = page.getByRole('region', {
        name: 'Calculation guide',
        exact: true,
      });
      assert.equal(await guide.locator('details').count(), 3);
      await guide.locator('summary').first().press('Enter');
      assert.equal(
        await guide.locator('details').first().getAttribute('open'),
        '',
      );
      const audit = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      assert.deepEqual(
        audit.violations.map((v) => v.id),
        [],
        `${name} ${theme} ${route} guide accessibility`,
      );
    }
  }
  await page.getByLabel('Theme', { exact: true }).selectOption('light');
  await page.setViewportSize({ width: 320, height: 740 });
  for (const route of ['render-time', 'frames-duration', 'playback-speed']) {
    await page.goto(`${origin}/${route}/`);
    await ready(page);
    await noOverflow(page);
    const tableRegion = page.locator('.guide-table');
    if (
      await tableRegion.evaluate(
        (element) => element.scrollWidth > element.clientWidth,
      )
    ) {
      await tableRegion.focus();
      await tableRegion.press('ArrowRight');
      await page.waitForFunction(
        () => document.querySelector('.guide-table').scrollLeft > 0,
      );
    }
  }
  await page.setViewportSize({ width: 1366, height: 900 });
  const staticContext = await context
    .browser()
    .newContext({ javaScriptEnabled: false });
  try {
    const staticPage = await staticContext.newPage();
    for (const route of ['render-time', 'frames-duration', 'playback-speed']) {
      await staticPage.goto(`${origin}/${route}/`);
      assert.equal(await staticPage.locator('h1').count(), 1);
      assert.equal(
        await staticPage.locator('.guide-table tbody tr').count(),
        route === 'playback-speed' ? 5 : 4,
      );
      assert.equal(await staticPage.locator('.guide-faq').count(), 3);
      await staticPage.locator('.guide-faq summary').first().click();
      assert.equal(
        await staticPage.locator('.guide-faq').first().getAttribute('open'),
        '',
      );
    }
    assert.equal(
      await staticPage.locator('.result-panel tbody td').innerText(),
      '0:20:00',
    );
  } finally {
    await staticContext.close();
  }
  console.log(
    `${name}: media presets, keyboard, savings, copy, shared/custom inputs, static guides, light/dark accessibility and narrow table scrolling passed.`,
  );
}

async function run(name, engine) {
  const browser = await engine.launch();
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    timezoneId: 'Europe/Vilnius',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const errors = [];
  const external = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (!r.url().startsWith(origin) && !r.url().startsWith('data:'))
      external.push(r.url());
  });
  try {
    for (const [id, expected] of Object.entries(reference)) {
      await page.goto(`${origin}/${id}/`);
      await ready(page);
      assert.equal(
        (await page.locator('.result-value').innerText()).trim(),
        expected,
        `${name} ${id}`,
      );
      await noOverflow(page);
      const accessibility = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      assert.deepEqual(
        accessibility.violations.map(
          (v) =>
            `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
        ),
        [],
        `${name} ${id} accessibility`,
      );
      await page.getByRole('button', { name: 'Share link' }).click();
      const url = await page
        .getByLabel('Share link', { exact: true })
        .inputValue();
      assert(url.includes('v=1'));
      await page.goto(url);
      await ready(page);
      assert.equal(
        (await page.locator('.result-value').innerText()).trim(),
        expected,
      );
      const first = page.locator('form input, form textarea').first();
      await first.fill('');
      await page.waitForSelector('.error');
      assert.equal(await page.locator('.result-value').count(), 0);
    }
    console.log(
      `${name}: 20 calculator pages, share round trips and invalid inputs passed.`,
    );
    await page.goto(`${origin}/timesheet/`);
    await ready(page);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download CSV' }).click();
    assert.equal((await download).suggestedFilename(), 'weekly-timesheet.csv');
    await page.goto(`${origin}/tools/`);
    await hydrated(page);
    assert.equal(await page.locator('.tool-tile').count(), 24);
    await page.getByLabel('Find a tool').fill('frames');
    assert.equal(await page.locator('.tool-tile').count(), 1);
    await page.getByLabel('Find a tool').fill('');
    await page
      .getByRole('button', { name: 'Add Online timer to favourites' })
      .click();
    await page.reload();
    await hydrated(page);
    await page.getByLabel('Favourites only').check();
    assert.equal(await page.locator('.tool-tile').count(), 1);
    await page.getByLabel('Favourites only').uncheck();
    await page
      .getByRole('navigation', { name: 'Time tools', exact: true })
      .getByRole('link', { name: 'Favourites', exact: true })
      .click();
    await page.waitForURL('**/tools/#favourites');
    await hydrated(page);
    await page.waitForFunction(
      () =>
        document.querySelector('.directory-controls input[type="checkbox"]')
          ?.checked,
    );
    assert.equal(await page.getByLabel('Favourites only').isChecked(), true);
    assert.equal(await page.locator('.tool-tile').count(), 1);
    await page.goto(origin);
    await ready(page);
    const homeA11y = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    assert.deepEqual(
      homeA11y.violations.map((v) => v.id),
      [],
      `${name} homepage accessibility`,
    );
    await page.getByLabel('Minutes', { exact: true }).fill('0');
    await page.getByLabel('Seconds', { exact: true }).fill('5');
    await page
      .getByRole('button', { name: 'Start timer', exact: true })
      .click();
    await page.waitForSelector('.timer-display');
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    const paused = await page.locator('.timer-display').innerText();
    await page.reload();
    await hydrated(page);
    assert.equal(await page.locator('.timer-display').innerText(), paused);
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await page.waitForSelector('body.timing-active');
    // Simulate a deadline missed while the browser was unavailable, then restore.
    await page.evaluate(() => {
      const saved = JSON.parse(sessionStorage.getItem('makeatimer:timer'));
      saved.timer.end = Date.now() - 5000;
      sessionStorage.setItem('makeatimer:timer', JSON.stringify(saved));
    });
    await page.reload();
    await hydrated(page);
    await page.waitForSelector('.notice');
    assert.equal(await page.locator('.timer-display').innerText(), '00:00');
    assert(
      await page
        .locator('body')
        .evaluate((b) => b.classList.contains('timing-active')),
    );
    await page.getByRole('button', { name: 'New timer' }).click();
    await page.getByRole('button', { name: 'Until a time' }).click();
    await page.getByLabel('Search time zone').fill('Los Angeles');
    await page
      .getByLabel('Time zone', { exact: true })
      .selectOption('America/Los_Angeles');
    await page.waitForSelector('.deadline-preview');
    assert.match(
      await page.locator('.deadline-preview').innerText(),
      /Today|Tomorrow/,
    );
    await page.getByRole('button', { name: 'Share link' }).click();
    const deadlineUrl = await page
      .getByLabel('Share link', { exact: true })
      .inputValue();
    assert(deadlineUrl.includes('instant='));
    const deadlineViewer = await context.newPage();
    await deadlineViewer.goto(deadlineUrl);
    await ready(deadlineViewer);
    await deadlineViewer.waitForSelector('.timer-display');
    assert.equal(
      await deadlineViewer
        .getByRole('button', { name: 'Pause', exact: true })
        .count(),
      0,
    );
    await deadlineViewer.reload();
    await ready(deadlineViewer);
    assert.equal(await deadlineViewer.locator('.timer-display').count(), 1);
    await deadlineViewer.close();
    await page.goto(`${origin}/countdown/`);
    await hydrated(page);
    await page.getByLabel('Event name').fill('<b>A safe event</b>');
    await page.getByLabel('Event date').fill('2027-01-01');
    await page.getByRole('button', { name: 'Start countdown' }).click();
    await page.waitForSelector('.timer-display');
    assert.match(
      await page.locator('.timer-card > .eyebrow').textContent(),
      /<b>A safe event<\/b>/,
    );
    assert.equal(await page.locator('.timer-card .eyebrow b').count(), 0);
    await page.goto(`${origin}/stopwatch/`);
    await ready(page);
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await page.getByRole('button', { name: 'Lap', exact: true }).click();
    assert.equal(await page.locator('.result-table tbody tr').count(), 1);
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    const elapsed = await page.locator('.timer-display').innerText();
    await page.reload();
    await ready(page);
    assert.equal(await page.locator('.timer-display').innerText(), elapsed);
    await page.getByRole('button', { name: 'Fullscreen', exact: true }).click();
    assert(
      await page
        .locator('.timer-card')
        .evaluate(
          (e) =>
            document.fullscreenElement === e ||
            e.classList.contains('fullscreen-fallback'),
        ),
    );
    await page.keyboard.press('Escape');
    await page.goto(`${origin}/interval-timer/`);
    await ready(page);
    await page.getByLabel('Work seconds').fill('1');
    await page.getByLabel('Rest seconds').fill('0');
    await page.getByLabel('Rounds').fill('2');
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await page.waitForSelector('.notice');
    assert.equal(
      (await page.locator('.notice').innerText()).trim(),
      'Session complete.',
    );
    await page.goto(`${origin}/#v=99&minutes=5`);
    await ready(page);
    assert.match(await page.locator('.notice').innerText(), /not supported/);
    console.log(
      `${name}: timer recovery, deadlines, event labels, laps, intervals, fullscreen, directory, CSV passed.`,
    );
    await wayfinding(page, context, name);
    await refinements(page, context, name);
    await mediaGuides(page, context, name);
    for (const viewport of [
      { width: 320, height: 740 },
      { width: 390, height: 844 },
      { width: 683, height: 450 },
      { width: 768, height: 1024 },
    ]) {
      await page.setViewportSize(viewport);
      for (const route of [
        '',
        'tools/',
        'timesheet/',
        'meeting-planner/',
        'render-time/',
        'frames-duration/',
        'playback-speed/',
      ]) {
        await page.goto(`${origin}/${route}`);
        await hydrated(page);
        await noOverflow(page);
      }
      await page.goto(origin);
      await ready(page);
      await page.screenshot({
        path: `output/playwright/${name}-${viewport.width}.png`,
        fullPage: true,
      });
    }
    await page.emulateMedia({ colorScheme: 'dark' });
    await noOverflow(page);
    await page.screenshot({
      path: `output/playwright/${name}-dark.png`,
      fullPage: true,
    });
    await page.emulateMedia({ colorScheme: 'light' });
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.screenshot({
      path: `output/playwright/${name}-desktop.png`,
      fullPage: true,
    });
    // Keyboard entry can operate the homepage without a pointer.
    await page.keyboard.press('Tab');
    assert(await page.evaluate(() => document.activeElement !== document.body));
    assert.deepEqual(errors, [], `${name} browser errors`);
    assert.deepEqual(
      external,
      [],
      `${name} external requests with advertising off`,
    );
    console.log(
      `${name}: mobile/tablet overflow, dark theme, keyboard and no external scripts passed.`,
    );
  } catch (e) {
    await page.screenshot({
      path: `output/playwright/${name}-failure.png`,
      fullPage: true,
    });
    throw e;
  } finally {
    await browser.close();
  }
}
try {
  const results = await Promise.allSettled([
    run('chromium', chromium),
    run('firefox', firefox),
    run('webkit', webkit),
  ]);
  for (const result of results)
    if (result.status === 'rejected') throw result.reason;
  console.log(
    'Browser verification passed in Chromium, Firefox, and WebKit. Device sizes are emulated.',
  );
} finally {
  server.close();
}
