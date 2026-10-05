import { chromium, firefox, webkit } from 'playwright';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';
import { staticServer } from './static-server.mjs';

const key = 'makeatimer:statistics:v1';
const lifetime = 180 * 24 * 60 * 60 * 1000;
const site = 'https://makeatimer.com';
const fixtureEnv = {
  ...process.env,
  MAKEATIMER_ANALYTICS_TEST: 'true',
  MAKEATIMER_AD_TEST: 'false',
  PUBLIC_LAUNCH_READY: 'true',
  PUBLIC_OPERATOR_NAME: 'MB „Faxcorp“',
  PUBLIC_CONTACT_EMAIL: 'hello@faxcorp.dev',
  PUBLIC_WEB_ANALYTICS_ENABLED: 'true',
  PUBLIC_WEB_ANALYTICS_TOKEN: '00000000000000000000000000000000',
  PUBLIC_CONSENT_ENABLED: 'true',
  PUBLIC_ADS_CLIENT: 'ca-pub-0000000000000000',
  PUBLIC_ADS_ENABLED: 'false',
  PUBLIC_CMP_READY: 'false',
};
await assert.rejects(
  promisify(execFile)(
    process.execPath,
    ['node_modules/astro/bin/astro.mjs', 'build'],
    { env: { ...fixtureEnv, PUBLIC_WEB_ANALYTICS_TOKEN: '' } },
  ),
  (error) =>
    /Enabled statistics require a valid Cloudflare Web Analytics token/.test(
      error.stdout + error.stderr,
    ),
);
await promisify(execFile)(
  process.execPath,
  ['node_modules/astro/bin/astro.mjs', 'build'],
  { env: fixtureEnv },
);
const { server, origin } = await staticServer(
  'output/playwright/analytics-dist',
);
await mkdir('output/playwright', { recursive: true });

async function ready(page) {
  await page.waitForFunction(
    () => !document.querySelector('astro-island')?.hasAttribute('ssr'),
  );
  await page.locator('#statistics-settings').waitFor({ state: 'visible' });
  await page.waitForFunction(
    () => !document.querySelector('#statistics-settings').disabled,
  );
}
async function statsReady(page) {
  await page.waitForFunction(() => window.__statisticsFixtureLoaded);
}
async function change(page, choice) {
  await page.locator('#statistics-settings').click();
  await page.locator(`#statistics-${choice}`).click();
}
async function withdraw(page) {
  await page.locator('#statistics-settings').click();
  assert.equal(await page.locator('#statistics-refresh').isVisible(), true);
  const reload = page.waitForEvent('load');
  await page.locator('#statistics-deny').click();
  await reload;
  await ready(page);
  assert.equal(await page.locator('#makeatimer-statistics-beacon').count(), 0);
}
const timerState = (page) =>
  page.evaluate(
    () => JSON.parse(sessionStorage.getItem('makeatimer:timer'))?.timer,
  );

try {
  for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await engine.launch();
    const errors = [];
    const contexts = [];
    async function context(options = {}) {
      const ctx = await browser.newContext({
        viewport: { width: 1366, height: 900 },
        serviceWorkers: 'block',
      });
      contexts.push(ctx);
      const loads = new Map();
      const payloads = [];
      ctx.on('page', (p) =>
        p.on('pageerror', (error) => errors.push(error.message)),
      );
      // Every request is routed: local public pages, an inert CMP, and a beacon contract stub.
      // Actual vendor payload sanitization is a separate production verification.
      await ctx.route('**/*', async (route) => {
        const req = route.request();
        const url = new URL(req.url());
        if (url.origin === site) {
          const response = await fetch(`${origin}${url.pathname}${url.search}`);
          await route.fulfill({
            status: response.status,
            contentType:
              response.headers.get('content-type') ||
              'application/octet-stream',
            body: Buffer.from(await response.arrayBuffer()),
          });
        } else if (url.hostname === 'static.cloudflareinsights.com') {
          const p = req.frame().page();
          loads.set(p, (loads.get(p) || 0) + 1);
          if (options.blockScript) {
            await route.abort();
            return;
          }
          await route.fulfill({
            contentType: 'text/javascript',
            body: `
            const config = JSON.parse(document.querySelector('#makeatimer-statistics-beacon').dataset.cfBeacon);
            if (config.spa !== false) throw Error('SPA tracking must be disabled');
            const clean = value => { const url = new URL(value); url.search = ''; url.hash = ''; return url.href; };
            fetch('https://cloudflareinsights.com/cdn-cgi/rum', { method: 'POST', body: JSON.stringify({ location: clean(location.href), referrer: document.referrer ? clean(document.referrer) : '', eventType: 1 }) }).then(() => { window.__statisticsFixtureLoaded = true; });
          `,
          });
        } else if (url.hostname === 'cloudflareinsights.com') {
          payloads.push(JSON.parse(req.postData()));
          await route.fulfill({
            status: 204,
            headers: { 'Access-Control-Allow-Origin': site },
          });
        } else if (/googlesyndication\.com$/.test(url.hostname)) {
          await route.fulfill({ contentType: 'text/javascript', body: '' });
        } else await route.abort();
      });
      if (options.saved)
        await ctx.addInitScript(
          ({ key, saved }) => {
            if (location.hostname !== 'makeatimer.com') return;
            if (!sessionStorage.getItem('fixture:seeded')) {
              localStorage.setItem(key, JSON.stringify(saved));
              sessionStorage.setItem('fixture:seeded', '1');
            }
          },
          { key, saved: options.saved },
        );
      if (options.blockStorage)
        await ctx.addInitScript(() => {
          if (location.hostname !== 'makeatimer.com') return;
          const get = Storage.prototype.getItem,
            set = Storage.prototype.setItem;
          Storage.prototype.getItem = function (...args) {
            if (this === localStorage) throw Error('Blocked storage');
            return get.apply(this, args);
          };
          Storage.prototype.setItem = function (...args) {
            if (this === localStorage) throw Error('Blocked storage');
            return set.apply(this, args);
          };
        });
      if (options.failWrites)
        await ctx.addInitScript((key) => {
          if (location.hostname !== 'makeatimer.com') return;
          const set = Storage.prototype.setItem;
          Storage.prototype.setItem = function (name, value) {
            if (this === localStorage && name === key)
              throw Error('Preference write blocked');
            return set.call(this, name, value);
          };
        }, key);
      return { ctx, loads, payloads };
    }

    try {
      const f = await context();
      const page = await f.ctx.newPage();
      await page.goto(`${site}/`);
      await ready(page);
      assert.equal(await page.locator('#statistics-notice').isVisible(), true);
      assert.equal(
        await page.evaluate(() => document.activeElement === document.body),
        true,
        'No focus moved to notice',
      );
      assert.equal(f.loads.size, 0);
      const allowStyle = await page
        .locator('#statistics-allow')
        .evaluate((el) => ({
          background: getComputedStyle(el).backgroundColor,
          color: getComputedStyle(el).color,
          border: getComputedStyle(el).borderColor,
        }));
      assert.deepEqual(
        await page.locator('#statistics-deny').evaluate((el) => ({
          background: getComputedStyle(el).backgroundColor,
          color: getComputedStyle(el).color,
          border: getComputedStyle(el).borderColor,
        })),
        allowStyle,
      );
      for (const theme of ['light', 'dark']) {
        await page.getByLabel('Theme', { exact: true }).selectOption(theme);
        const audit = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        assert.deepEqual(
          audit.violations.map((v) => v.id),
          [],
          `${name} ${theme} notice accessibility`,
        );
      }
      for (const width of [320, 390, 768]) {
        await page.setViewportSize({ width, height: 844 });
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        );
        const start = await page
          .getByRole('button', { name: 'Start timer', exact: true })
          .boundingBox();
        await page.screenshot({
          path: `output/playwright/statistics-${name}-${width}.png`,
          fullPage: true,
        });
        assert(
          start.y + start.height <= 844,
          `${name} first-screen Start with statistics notice at ${width}: ${JSON.stringify(start)}`,
        );
      }
      await page.screenshot({
        path: `output/playwright/statistics-${name}-notice.png`,
        fullPage: true,
      });
      await page.locator('#statistics-deny').click();
      await page.reload();
      await ready(page);
      assert.equal(await page.locator('#statistics-notice').isVisible(), false);
      assert.equal(f.loads.size, 0, 'Saved refusal never loads beacon');
      await change(page, 'allow');
      await statsReady(page);
      await change(page, 'allow');
      assert.equal(
        f.loads.get(page),
        1,
        'Repeated acceptance cannot duplicate script',
      );
      assert.equal(
        await page.locator('ins').count(),
        0,
        'Statistics do not enable advertising',
      );
      await page.getByLabel('Minutes', { exact: true }).fill('2');
      await page
        .getByRole('button', { name: 'Start timer', exact: true })
        .click();
      await page.waitForSelector('.timer-display');
      const running = await timerState(page);
      const address = page.url();
      await withdraw(page);
      assert.equal(page.url(), address);
      assert.equal((await timerState(page)).end, running.end);
      assert.equal((await timerState(page)).status, 'running');
      assert.equal(f.loads.get(page), 1);
      await change(page, 'allow');
      await statsReady(page);
      await page.getByRole('button', { name: 'Pause', exact: true }).click();
      const paused = await timerState(page);
      await withdraw(page);
      assert.deepEqual(
        await timerState(page),
        paused,
        'Paused state survives withdrawal',
      );
      await page.goto(`${site}/`);
      await ready(page);
      await page
        .getByRole('button', { name: 'Stop / edit', exact: true })
        .click();
      await page.getByLabel('Minutes', { exact: true }).fill('7');
      await change(page, 'allow');
      await statsReady(page);
      await withdraw(page);
      assert.equal(
        await page.getByLabel('Minutes', { exact: true }).inputValue(),
        '7',
      );
      assert.equal(
        await page.locator('.timer-display').count(),
        0,
        'Own draft stays editable',
      );

      for (const [route, storageKey] of [
        ['stopwatch/', 'makeatimer:stopwatch'],
        ['interval-timer/', 'makeatimer:interval'],
      ]) {
        await page.goto(`${site}/${route}`);
        await ready(page);
        await change(page, 'allow');
        await statsReady(page);
        await page.getByRole('button', { name: 'Start', exact: true }).click();
        await page.getByRole('button', { name: 'Pause', exact: true }).click();
        const saved = await page.evaluate(
          (key) => JSON.parse(sessionStorage.getItem(key)),
          storageKey,
        );
        await withdraw(page);
        const recovered = await page.evaluate(
          (key) => JSON.parse(sessionStorage.getItem(key)),
          storageKey,
        );
        assert.equal(recovered.status, 'paused');
        assert.equal(recovered.base, saved.base);
        assert.deepEqual(recovered.inputs, saved.inputs);
      }

      await page.goto(
        `${site}/frames-duration/?example=private-query#v=1&frames=240&fps=24&label=private-fragment`,
      );
      await ready(page);
      await change(page, 'allow');
      await statsReady(page);
      await page.waitForFunction(() => !!window.__statisticsFixtureLoaded);
      // The stub obeys Cloudflare's documented URL contract; production evidence checks the actual vendor.
      assert(
        f.payloads.every(
          (payload) =>
            !/[?#]|private-query|private-fragment/.test(
              payload.location + payload.referrer,
            ),
        ),
      );
      const before = f.payloads.length;
      await page.evaluate(() =>
        history.replaceState(null, '', '#v=1&frames=1234&fps=24'),
      );
      await page.getByLabel('Frame count', { exact: true }).fill('240');
      assert.equal(
        f.payloads.length,
        before,
        'Hash/input updates are not SPA page views',
      );
      await page.reload();
      await ready(page);
      await statsReady(page);
      assert.equal(
        await page.locator('#statistics-notice').isVisible(),
        false,
        'Saved allowance loads without asking again',
      );

      // An allowance in one tab reaches another; withdrawal stops both via same-URL reload.
      const other = await f.ctx.newPage();
      await other.goto(`${site}/`);
      await ready(other);
      await statsReady(other);
      await other
        .getByRole('button', { name: 'Start timer', exact: true })
        .click();
      const otherEnd = (await timerState(other)).end;
      const otherReload = other.waitForEvent('load');
      await withdraw(page);
      await otherReload;
      await ready(other);
      assert.equal(
        await other.locator('#makeatimer-statistics-beacon').count(),
        0,
      );
      assert.equal((await timerState(other)).end, otherEnd);
      await change(page, 'allow');
      await statsReady(page);
      await statsReady(other);
      const clearing = Promise.all([
        page.waitForEvent('load'),
        other.waitForEvent('load'),
      ]);
      await page.evaluate((key) => {
        localStorage.removeItem(key);
        window.dispatchEvent(new StorageEvent('storage', { key }));
      }, key);
      await clearing;
      await ready(page);
      await ready(other);
      assert.equal(await page.locator('#statistics-notice').isVisible(), true);
      assert.equal(await other.locator('#statistics-notice').isVisible(), true);

      for (const options of [
        {
          saved: {
            version: 1,
            choice: 'allowed',
            savedAt: Date.now() - lifetime - 1,
          },
        },
        { blockStorage: true },
      ]) {
        const failed = await context(options);
        const p = await failed.ctx.newPage();
        await p.goto(`${site}/`);
        await ready(p);
        assert.equal(await p.locator('#statistics-notice').isVisible(), true);
        if (options.blockStorage) {
          await p.locator('#statistics-allow').click();
          assert.match(
            await p.locator('#statistics-status').innerText(),
            /could not be saved/,
          );
        }
        assert.equal(failed.loads.size, 0);
        await p
          .getByRole('button', { name: 'Start timer', exact: true })
          .click();
        await p.waitForSelector('.timer-display');
      }
      const blocked = await context({ blockScript: true });
      const p = await blocked.ctx.newPage();
      await p.goto(`${site}/`);
      await ready(p);
      await p.locator('#statistics-allow').click();
      await p.locator('#statistics-settings').click();
      await p.waitForFunction(() =>
        document
          .querySelector('#statistics-status')
          .textContent.includes('could not load'),
      );
      await p.locator('#statistics-allow').click();
      assert.equal(blocked.loads.get(p), 1);
      assert.equal(blocked.payloads.length, 0);
      const failedWrite = await context({
        saved: { version: 1, choice: 'allowed', savedAt: Date.now() },
        failWrites: true,
      });
      const failedPage = await failedWrite.ctx.newPage();
      await failedPage.goto(`${site}/`);
      await ready(failedPage);
      await statsReady(failedPage);
      await failedPage.locator('#statistics-settings').click();
      const failedReload = failedPage.waitForEvent('load');
      await failedPage.locator('#statistics-deny').click();
      await failedReload;
      await ready(failedPage);
      assert.equal(
        await failedPage.locator('#makeatimer-statistics-beacon').count(),
        0,
        'A failed withdrawal write cannot restore an old allowance',
      );
      assert.match(
        await failedPage.locator('#statistics-status').innerText(),
        /could not be saved/,
      );
      assert.equal(failedWrite.loads.get(failedPage), 1);
      assert.deepEqual(errors, []);
      console.log(
        `${name}: worldwide statistics choices, saved/expired state, blocked storage/script, single injection, cross-tab withdrawal, timer/draft/paused recovery, mobile and accessibility passed. Vendor traffic was stubbed.`,
      );
    } finally {
      await Promise.all(contexts.map((ctx) => ctx.close()));
      await browser.close();
    }
  }
} finally {
  server.close();
}
