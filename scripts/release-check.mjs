import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
try {
  process.loadEnvFile('.env');
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
}
assert.equal(
  process.env.PUBLIC_LAUNCH_READY,
  'true',
  'Set PUBLIC_LAUNCH_READY=true for a production release.',
);
assert(
  process.env.PUBLIC_OPERATOR_NAME?.trim(),
  'Confirm the public operator name in deployment configuration.',
);
assert(
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.PUBLIC_CONTACT_EMAIL || ''),
  'Confirm the public contact email.',
);
const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
  .trim()
  .split(/\r?\n/)
  .filter(Boolean);
assert(files.length, 'Stage and review the public files first.');
for (const file of files) {
  assert(
    !/(^|\/)(node_modules|output|private|\.env|agents\.md|handoff\.md|implementation-plan\.md)(\/|$)/i.test(
      file,
    ),
    `Private tracked file: ${file}`,
  );
  if (
    /\.(?:md|json|mjs|ts|svelte|astro|yml|css|txt|jsonc|example)$/.test(file)
  ) {
    const text = await readFile(file, 'utf8');
    assert(
      !/(?:AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{30,}|-----BEGIN (?:RSA |OPENSSH )?PRIVATE KEY-----)/.test(
        text,
      ),
      `Potential credential: ${file}`,
    );
  }
}
let identities = '';
try {
  identities = execFileSync('git', ['log', '--format=%ae%n%ce'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
} catch {
  /* No commits yet. */
}
assert(
  !identities ||
    identities
      .split(/\r?\n/)
      .every((email) => email.endsWith('@users.noreply.github.com')),
  'Every author and committer must use a GitHub noreply address.',
);
const robots = await readFile('dist/robots.txt', 'utf8');
assert.match(robots, /Allow: \//);
assert(
  !robots.includes('Disallow: /'),
  'Build production output before release.',
);
const home = await readFile('dist/index.html', 'utf8');
assert.equal(
  home.includes('id="statistics-settings"'),
  process.env.PUBLIC_WEB_ANALYTICS_ENABLED === 'true',
  'Statistics activation must match the built release.',
);
if (process.env.PUBLIC_WEB_ANALYTICS_ENABLED === 'true')
  assert(
    /^[a-f0-9]{32}$/i.test(process.env.PUBLIC_WEB_ANALYTICS_TOKEN || ''),
    'Enabled statistics require the existing property token.',
  );
console.log(
  `Release checks passed for ${files.length} tracked files. Review file contents and history before pushing; this scan is not a substitute for review.`,
);
