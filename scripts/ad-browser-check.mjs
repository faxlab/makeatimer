import { chromium } from 'playwright';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { staticServer } from './static-server.mjs';
// Test-only IDs and a mock consent adapter. Never request or click a live ad.
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
let scripts = 0;
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.route('**/fundingchoicesmessages.google.com/**', async (route) => {
  await route.fulfill({
    contentType: 'text/javascript',
    body: `
    let listener;
    window.__cmpResolve = (permitted, eventStatus = 'useractioncomplete') => listener?.({
      cmpId: 300, cmpStatus: 'loaded', gdprApplies: true, eventStatus,
      tcString: 'test-only-consent', purpose: { consents: { 1: permitted } },
      vendor: { consents: { 755: permitted } }
    }, true);
    window.__tcfapi = (command, version, callback) => {
      if (command === 'addEventListener') { listener = callback; window.__cmpResolve(false, 'cmpuishown'); }
    };
    const queue = window.googlefc.callbackQueue;
    window.googlefc.showRevocationMessage = () => {
      window.__cmpOpened = (window.__cmpOpened || 0) + 1;
      window.__cmpResolve(false, 'cmpuishown');
    };
    window.googlefc.callbackQueue = { push(entry) { entry.CONSENT_API_READY?.(); } };
    queue.forEach(entry => entry.CONSENT_API_READY?.());
  `,
  });
});
await page.route('**/pagead2.googlesyndication.com/**', async (route) => {
  scripts++;
  await route.fulfill({
    contentType: 'text/javascript',
    body: 'window.__adMockLoaded = true;',
  });
});
async function ready() {
  await page.waitForFunction(() => {
    const island = document.querySelector('astro-island');
    return island && !island.hasAttribute('ssr');
  });
}
async function consent(permit) {
  await page.waitForFunction(() => window.__cmpResolve);
  await page.evaluate((permitted) => window.__cmpResolve(permitted), permit);
}
try {
  await page.goto(`${origin}/work-hours/`);
  await ready();
  assert.equal(await page.locator('.ad-slot').count(), 3);
  assert.equal(scripts, 0);
  await consent(false);
  assert.equal(await page.locator('.ad-side').isVisible(), true);
  assert((await page.locator('.tool-main').boundingBox()).width >= 800);
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert.equal(scripts, 0);
  await consent(false);
  assert.equal(scripts, 0);
  const before = await page.locator('.ad-result').boundingBox();
  await consent(true);
  await page.waitForFunction(() => window.__adMockLoaded);
  const after = await page.locator('.ad-result').boundingBox();
  assert.equal(after.height, before.height);
  assert.equal(after.width, before.width);
  assert.equal(scripts, 1);
  await page
    .getByRole('button', { name: 'Privacy choices', exact: true })
    .click();
  assert.equal(await page.locator('body.consent-pending').count(), 1);
  assert.equal(await page.evaluate(() => window.__cmpOpened), 1);
  assert.equal(await page.locator('.ad-result').isVisible(), false);
  assert.equal(scripts, 1);
  await consent(true);
  assert.equal(await page.locator('body.consent-pending').count(), 0);
  assert.equal(scripts, 1);
  await page.getByLabel('Clock in').fill('');
  await page.waitForSelector('body.tool-error');
  assert.equal(await page.locator('.ad-result').isVisible(), false);
  await page.getByLabel('Clock in').fill('09:00');
  await page.waitForFunction(
    () => !document.body.classList.contains('tool-error'),
  );
  assert.equal(scripts, 1);
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
  await consent(false);
  await page.waitForLoadState();
  await ready();
  assert.equal(scripts, 1);
  await page.goto(origin);
  await ready();
  await page.getByRole('button', { name: 'Start timer', exact: true }).click();
  await page.waitForSelector('body.timing-active');
  await consent(true);
  assert.equal(scripts, 1);
  assert.equal(await page.locator('.ad-result').isVisible(), false);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  assert.equal(await page.locator('.ad-result').isVisible(), false);
  await page.getByRole('button', { name: 'Fullscreen', exact: true }).click();
  assert.equal(await page.locator('.ad-result').isVisible(), false);
  await page.keyboard.press('Escape');
  await page.reload();
  await ready();
  await consent(true);
  assert.equal(scripts, 1);
  assert.equal(await page.locator('.ad-result').isVisible(), false);
  await page.getByRole('button', { name: 'Stop / edit' }).click();
  await page.waitForFunction(() => window.__adMockLoaded);
  assert.equal(scripts, 2);
  // A failed ad script must not affect a calculation.
  await page.route('**/pagead2.googlesyndication.com/**', (route) =>
    route.abort(),
  );
  await page.goto(`${origin}/work-hours/`);
  await ready();
  await consent(true);
  await page.getByLabel('Unpaid break minutes').fill('60');
  await page.waitForFunction(
    () => document.querySelector('.result-value')?.textContent === '7:30:00',
  );
  assert.deepEqual(errors, []);
  // Consent-only builds must offer preferences without ever requesting ads, including after acceptance.
  await buildFixture('false');
  const beforeConsentOnly = scripts;
  await page.goto(`${origin}/work-hours/`);
  await ready();
  await consent(true);
  assert.equal(await page.locator('.ad-slot').count(), 0);
  assert.equal(scripts, beforeConsentOnly);
  await page
    .getByRole('button', { name: 'Privacy choices', exact: true })
    .click();
  assert.equal(await page.evaluate(() => window.__cmpOpened), 1);
  await consent(false);
  assert.equal(scripts, beforeConsentOnly);
  await page.reload();
  await ready();
  await consent(false);
  assert.equal(scripts, beforeConsentOnly);
  // A blocked CMP must leave calculators usable and the ad gate closed.
  await page.route('**/fundingchoicesmessages.google.com/**', (route) =>
    route.abort(),
  );
  await page.reload();
  await ready();
  await page.waitForFunction(() =>
    document
      .querySelector('#consent-settings')
      ?.title.includes('could not load'),
  );
  await page.getByLabel('Unpaid break minutes').fill('60');
  assert.equal(await page.locator('.result-value').textContent(), '7:30:00');
  assert.equal(scripts, beforeConsentOnly);
  assert.deepEqual(errors, []);
  console.log(
    'Ad/CMP fixtures passed: refusal/permission/revocation, preference reopening, consent-only build with no ads, blocked CMP/ads, stable slots, desktop/mobile placements, active/paused/restored/fullscreen/error suppression. No live ads were requested.',
  );
} finally {
  await browser.close();
  server.close();
}
