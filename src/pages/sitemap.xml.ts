import { config } from '../lib/config';
import { tools, toolPath } from '../lib/tools';
export function GET() {
  const paths = [
    ...tools.map((t) => toolPath(t.id)),
    '/tools/',
    '/about/',
    '/contact/',
    '/privacy/',
    '/terms/',
    '/conventions/',
  ];
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((p) => `<url><loc>${config.origin}${p}</loc></url>`).join('')}</urlset>`,
    { headers: { 'Content-Type': 'application/xml' } },
  );
}
