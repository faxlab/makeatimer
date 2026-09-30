import { readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
const paths = [
  '',
  'countdown',
  'stopwatch',
  'interval-timer',
  'time-calculator',
  'sum-durations',
  'time-between',
  'work-hours',
  'timesheet',
  'decimal-hours',
  'time-units',
  'start-finish',
  'date-difference',
  'add-dates',
  'business-days',
  'weekday',
  'iso-week',
  'time-zone',
  'meeting-planner',
  'playback-speed',
  'speech-duration',
  'running-pace',
  'render-time',
  'frames-duration',
  'tools',
  'about',
  'contact',
  'privacy',
  'terms',
  'conventions',
];
const titles = new Set();
for (const route of paths) {
  const html = await readFile(path.join('dist', route, 'index.html'), 'utf8');
  const title = html.match(/<title>(.*?)<\/title>/)?.[1];
  assert(title && !titles.has(title), `Unique title: ${route}`);
  titles.add(title);
  assert.match(html, /name="description" content="[^"]+"/, route);
  assert.match(html, /<h1[\s>]/, route);
  assert(
    html.includes(`https://makeatimer.com/${route ? route + '/' : ''}`),
    `Canonical: ${route}`,
  );
  if (paths.indexOf(route) < 24) {
    assert.match(html, /WebApplication/, route);
    assert.match(html, /Copy result/, route);
    assert.match(html, /Share link/, route);
  }
  assert(
    !/[A-Z]:\\(?:WORK|Users)\\/i.test(html) &&
      !html.includes('implementation-plan'),
    `Private content: ${route}`,
  );
  for (const match of html.matchAll(
    /(?:src|href|component-url|renderer-url)="(\/_astro\/[^"?]+)"/g,
  ))
    await readFile(path.join('dist', match[1]));
}
const sitemap = await readFile('dist/sitemap.xml', 'utf8');
assert.equal((sitemap.match(/<loc>/g) || []).length, 30);
const notFound = await readFile('dist/404.html', 'utf8');
assert.match(notFound, /name="robots" content="noindex,nofollow"/);
async function scan(dir) {
  for (const file of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, file.name);
    if (file.isDirectory()) await scan(full);
    else
      assert(
        !/^(agents\.md|implementation-plan\.md|handoff\.md|\.env)$/i.test(
          file.name,
        ),
        `Forbidden output: ${full}`,
      );
  }
}
await scan('dist');
console.log(
  `Static validation passed: ${paths.length} pages, canonical URLs, structured data, sitemap, private boundary.`,
);
