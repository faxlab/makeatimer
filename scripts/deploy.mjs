import { spawnSync } from 'node:child_process';
import { productionEnv as env } from './production-env.mjs';

for (const args of [
  ['scripts/release-check.mjs'],
  ['node_modules/wrangler/bin/wrangler.js', 'deploy'],
]) {
  const result = spawnSync(process.execPath, args, { env, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
