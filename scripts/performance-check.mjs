import lighthouse from 'lighthouse';
import { chromium } from 'playwright';
import { staticServer } from './static-server.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { server, origin } = await staticServer('dist');
const browser = await chromium.launch({
  args: ['--remote-debugging-port=9223'],
});
try {
  const { lhr } = await lighthouse(origin, {
    port: 9223,
    output: 'json',
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
  });
  await mkdir('output/playwright', { recursive: true });
  await writeFile(
    'output/playwright/lighthouse.json',
    JSON.stringify(lhr, null, 2),
  );
  const scores = Object.fromEntries(
    Object.entries(lhr.categories).map(([id, category]) => [
      id,
      category.score * 100,
    ]),
  );
  const lcp = lhr.audits['largest-contentful-paint'].numericValue;
  const cls = lhr.audits['cumulative-layout-shift'].numericValue;
  const tbt = lhr.audits['total-blocking-time'].numericValue;
  console.log(
    JSON.stringify(
      {
        scores,
        mobileLab: { lcpMs: Math.round(lcp), cls, totalBlockingTimeMs: tbt },
        note: 'Local simulated mobile lab; preview noindex intentionally limits SEO score. INP requires real-user monitoring after launch.',
      },
      null,
      2,
    ),
  );
  assert(lcp <= 2500, 'Mobile lab LCP must be within 2.5 seconds.');
  assert(cls < 0.1, 'Mobile lab CLS must be below 0.1.');
} finally {
  await browser.close();
  server.close();
}
