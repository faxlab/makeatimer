import { chromium } from 'playwright';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { staticServer } from './static-server.mjs';
// Real CMP and ad traffic are intercepted. Only public fixture IDs are used.
async function buildFixture(adsEnabled = 'true') {
  await promisify(execFile)(
    process.execPath,
    ['node_modules/astro/bin/astro.mjs', 'build'],
    {
      env: {
        ...process.env,
        MAKEATIMER_AD_TEST: 'true',
        PUBLIC_LAUNCH_READY: 'true',
        PUBLIC_OPERATOR_NAME: 'FAXCORP',
        PUBLIC_CONTACT_EMAIL: 'hello@faxcorp.dev',
        PUBLIC_CMP_READY: 'true',
        PUBLIC_CONSENT_ENABLED: 'true',
        PUBLIC_ADS_ENABLED: adsEnabled,
        PUBLIC_ADS_CLIENT: 'ca-pub-0000000000000000',
        PUBLIC_ADS_SIDE_SLOT: '111',
        PUBLIC_ADS_RESULT_SLOT: '222',
        PUBLIC_ADS_CONTENT_SLOT: '333',
      },
    },
  );
}
await buildFixture();
const { server, origin } = await staticServer('output/playwright/ads-dist');
await mkdir('output/playwright', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
let baseTags = 0;
const mockBase = async (route) => {
  baseTags++;
  await route.fulfill({
    contentType: 'text/javascript',
    body: `
    window.__adMockRequests = 0;
    window.adsbygoogle = { push() { window.__adMockRequests++; } };
    const cmp = document.createElement('script');
    cmp.src = 'https://fundingchoicesmessages.google.com/test-cmp';
    document.head.append(cmp);
  `,
  });
};
await page.route('**/pagead2.googlesyndication.com/**', mockBase);
await page.route('**/fundingchoicesmessages.google.com/**', async (route) => {
  await route.fulfill({
    contentType: 'text/javascript',
    body: `
    let listener;
    window.__cmpResolve = (permitted, eventStatus = 'useractioncomplete') => listener?.({
      cmpId: 300, cmpStatus: 'loaded', gdprApplies: true, eventStatus,
      tcString: 'fixture-only', purpose: { consents: { 1: permitted } },
      vendor: { consents: { 755: permitted } }
    }, true);
    window.__tcfapi = (command, version, callback) => {
      if (command === 'addEventListener') { listener = callback; window.__cmpResolve(false, 'cmpuishown'); }
    };
    window.googlefc.showRevocationMessage = () => {
      window.__cmpOpened = (window.__cmpOpened || 0) + 1;
      window.__cmpResolve(false, 'cmpuishown');
    };
    const queue = window.googlefc.callbackQueue;
    window.googlefc.callbackQueue = { push(entry) { entry.CONSENT_API_READY?.(); } };
    queue.forEach(entry => entry.CONSENT_API_READY?.());
  `,
  });
});
async function hydrated() {
  await page.waitForFunction(() => {
    const island = document.querySelector('astro-island');
    return island && !island.hasAttribute('ssr');
  });
}
async function ready() {
  await hydrated();
  await page.waitForFunction(() => window.__cmpResolve);
}
async function consent(permit) {
  await page.evaluate((permitted) => window.__cmpResolve(permitted), permit);
}
const requests = () => page.evaluate(() => window.__adMockRequests || 0);
try {
  await page.goto(`${origin}/work-hours/`);
  await ready();
  assert.equal(await page.locator('.ad-slot').count(), 3);
  assert.equal(await requests(), 0);
  await consent(false);
  assert.equal(await requests(), 0);
  assert.equal(await page.locator('.ad-side').isVisible(), true);
  assert((await page.locator('.tool-main').boundingBox()).width >= 800);
  const before = await page.locator('.ad-result').boundingBox();
  await consent(true);
  const after = await page.locator('.ad-result').boundingBox();
  assert.equal(after.height, before.height);
  assert.equal(after.width, before.width);
  await page.locator('.ad-content').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => window.__adMockRequests === 3);
  const filled = await requests();
  assert(filled > 0 && filled <= 3);
  assert.equal(baseTags, 1);
  await page
    .getByRole('button', { name: 'Privacy choices', exact: true })
    .click();
  assert.equal(await page.evaluate(() => window.__cmpOpened), 1);
  assert.equal(await page.locator('.ad-result').isVisible(), false);
  assert.equal(await requests(), filled);
  await consent(true);
  assert.equal(await requests(), filled);
  assert.equal(baseTags, 1);
  await page.getByLabel('Clock in').fill('');
  await page.waitForSelector('body.tool-error');
  assert.equal(await page.locator('.ad-result').isVisible(), false);
  await page.getByLabel('Clock in').fill('09:00');
  await page.waitForFunction(
    () => !document.body.classList.contains('tool-error'),
  );
  assert.equal(await requests(), filled);
  await page.screenshot({
    path: 'output/playwright/ads-desktop.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  assert.equal(await page.locator('.ad-side').isVisible(), false);
  assert((await page.locator('.tool-main').boundingBox()).width >= 800);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.locator('.ad-side').isVisible(), false);
  assert.equal(await page.locator('.ad-result').isVisible(), true);
  assert.equal(await page.locator('.ad-content').isVisible(), true);
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: 'output/playwright/ads-mobile.png',
    fullPage: true,
  });
  const revokedLoad = page.waitForEvent('load');
  await consent(false);
  await revokedLoad;
  await ready();
  assert.equal(await requests(), 0);
  await page.goto(origin);
  await ready();
  await page.getByRole('button', { name: 'Start timer', exact: true }).click();
  await page.waitForSelector('body.timing-active');
  await consent(true);
  assert.equal(await requests(), 0);
  assert.equal(await page.locator('.ad-result').isVisible(), false);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  assert.equal(await page.locator('.ad-result').isVisible(), false);
  await page.getByRole('button', { name: 'Fullscreen', exact: true }).click();
  assert.equal(await page.locator('.ad-result').isVisible(), false);
  await page.keyboard.press('Escape');
  await page.reload();
  await ready();
  await consent(true);
  assert.equal(await requests(), 0);
  await page.getByRole('button', { name: 'Stop / edit' }).click();
  await page.locator('.ad-result').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => window.__adMockRequests > 0);
  // A blocked base tag must leave calculators usable and both consent and ads unavailable.
  await page.route('**/pagead2.googlesyndication.com/**', (route) =>
    route.abort(),
  );
  await page.goto(`${origin}/work-hours/`);
  await hydrated();
  await page.waitForFunction(
    () => document.body.dataset.consentState === 'unavailable',
  );
  await page.getByLabel('Unpaid break minutes').fill('60');
  assert.equal(await page.locator('.result-value').textContent(), '7:30:00');
  assert.equal(await requests(), 0);
  await page.unroute('**/pagead2.googlesyndication.com/**');
  await page.route('**/pagead2.googlesyndication.com/**', mockBase);
  // Consent-only builds deliver preferences without manual ad requests even after acceptance.
  await buildFixture('false');
  await page.goto(`${origin}/work-hours/`);
  await ready();
  await consent(true);
  assert.equal(await page.locator('.ad-slot').count(), 0);
  assert.equal(await requests(), 0);
  await page
    .getByRole('button', { name: 'Privacy choices', exact: true })
    .click();
  assert.equal(await page.evaluate(() => window.__cmpOpened), 1);
  await consent(false);
  assert.equal(await requests(), 0);
  await page.reload();
  await ready();
  await consent(false);
  assert.equal(await requests(), 0);
  await page.route('**/fundingchoicesmessages.google.com/**', (route) =>
    route.abort(),
  );
  await page.reload();
  await hydrated();
  assert.equal(
    await page
      .getByRole('button', { name: 'Privacy choices', exact: true })
      .isEnabled(),
    false,
  );
  await page.getByLabel('Unpaid break minutes').fill('60');
  assert.equal(await page.locator('.result-value').textContent(), '7:30:00');
  assert.equal(await requests(), 0);
  // A delivered API without a usable message must not leave a dead settings button.
  await page.route('**/fundingchoicesmessages.google.com/**', async (route) => {
    await route.fulfill({
      contentType: 'text/javascript',
      body: `
      let listener;
      window.__cmpResolve = (permitted) => listener?.({
        cmpId: 300, cmpStatus: 'loaded', gdprApplies: true,
        eventStatus: 'useractioncomplete', tcString: 'fixture-only',
        purpose: { consents: { 1: permitted } }, vendor: { consents: { 755: permitted } }
      }, true);
      window.__tcfapi = (command, version, callback) => {
        listener = callback;
        callback({ cmpId: 300, cmpStatus: 'loaded' }, true);
        callback({ cmpId: 300, cmpStatus: 'loaded', gdprApplies: true, eventStatus: 'tcloaded', tcString: '' }, true);
      };
      window.googlefc.showRevocationMessage = () => {};
      const queue = window.googlefc.callbackQueue;
      window.googlefc.callbackQueue = { push(entry) { entry.CONSENT_API_READY?.(); } };
      queue.forEach(entry => entry.CONSENT_API_READY?.());
      `,
    });
  });
  await page.clock.install();
  await page.reload();
  await ready();
  await page.clock.fastForward(30_001);
  assert.equal(
    await page.locator('body').getAttribute('data-consent-state'),
    'unavailable',
  );
  assert.equal(await page.locator('#consent-settings').isEnabled(), false);
  assert.equal(await page.locator('#consent-status').isVisible(), true);
  assert.match(
    await page.locator('#consent-status').innerText(),
    /Advertising stays off/,
  );
  assert.equal(await requests(), 0);
  await consent(true);
  assert.equal(await page.locator('#consent-settings').isEnabled(), true);
  assert.equal(await page.locator('#consent-status').innerText(), '');
  assert.equal(await requests(), 0);
  await page.locator('#consent-settings').click();
  await page.clock.fastForward(30_001);
  assert.equal(
    await page.locator('body').getAttribute('data-consent-state'),
    'unavailable',
  );
  assert.equal(await requests(), 0);
  await consent(false);
  assert.equal(
    await page.locator('body').getAttribute('data-ad-consent'),
    'blocked',
  );
  assert.equal(await page.locator('#consent-settings').isEnabled(), true);
  assert.deepEqual(errors, []);
  console.log(
    'Ad/CMP fixtures passed: consent/refusal/revocation, one base tag, preference reopening, silent-message timeouts and late recovery, no manual requests in consent-only builds, blocked scripts, stable slots, mobile/desktop, active/paused/restored/fullscreen/error suppression. No live ads were requested.',
  );
} finally {
  await browser.close();
  server.close();
}
