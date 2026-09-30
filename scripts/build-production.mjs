import { spawnSync } from 'node:child_process';
import { productionEnv as env } from './production-env.mjs';

// Only this explicit release command enables indexing. Normal builds stay previews.

for (const args of [
  ['node_modules/astro/bin/astro.mjs', 'build'],
  ['scripts/validate-build.mjs'],
  ['scripts/release-check.mjs'],
]) {
  const result = spawnSync(process.execPath, args, { env, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
