import { config } from '../lib/config';
export function GET() {
  return new Response(
    `User-agent: *\n${config.launchReady ? 'Allow: /' : 'Disallow: /'}\nSitemap: ${config.origin}/sitemap.xml\n`,
    { headers: { 'Content-Type': 'text/plain' } },
  );
}
