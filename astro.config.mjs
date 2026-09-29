import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';

if (
  process.env.PUBLIC_LAUNCH_READY === 'true' &&
  (!process.env.PUBLIC_OPERATOR_NAME?.trim() ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.PUBLIC_CONTACT_EMAIL || ''))
) {
  throw new Error(
    'A public launch requires the exact operator name and a valid public contact email.',
  );
}

export default defineConfig({
  site: 'https://makeatimer.com',
  output: 'static',
  outDir:
    process.env.MAKEATIMER_AD_TEST === 'true'
      ? './output/playwright/ads-dist'
      : './dist',
  trailingSlash: 'always',
  integrations: [svelte()],
  devToolbar: { enabled: false },
});
