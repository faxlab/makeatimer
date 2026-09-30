import { config } from '../lib/config';
export function GET() {
  return new Response(
    config.launchReady && /^ca-pub-\d{16}$/.test(config.client)
      ? `google.com, ${config.client.replace('ca-', '')}, DIRECT, f08c47fec0942fa0\n`
      : '# Advertising is disabled.\n',
    { headers: { 'Content-Type': 'text/plain' } },
  );
}
