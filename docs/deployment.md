# Static deployment

Build with `npm ci` followed by `npm run verify`. Deploy only `dist/`. The supplied `wrangler.jsonc` configures static assets, directory-style URLs, and the 404 page; there is no runtime Worker or backend service.

Connect the public repository to Cloudflare Workers Builds. Use `main` for production and set the build command to `npm ci && npm run check && npm test && npm run build:production`. Wrangler is pinned in the lockfile. Set the deploy command to `npm run deploy`, which refuses noindex preview output. Do not place credentials in this repository.

## Production configuration

Set `PUBLIC_LAUNCH_READY=true`, `PUBLIC_OPERATOR_NAME` to the confirmed legal operator name, and `PUBLIC_CONTACT_EMAIL` to the public contact address. Build and review About, Contact, Privacy, and Terms. The build refuses indexing without those values. Preview/PR environments must use `PUBLIC_LAUNCH_READY=false`; their robots file disallows crawling and every page uses noindex.

Configure `makeatimer.com` as the custom domain. In Cloudflare, configure an HTTPS redirect from `www.makeatimer.com/*` to `https://makeatimer.com/$1`, preserving the path and query. Do not add an application Worker for this redirect. Verify TLS, redirects, real 404s, canonicals, robots, and the sitemap after deployment.

`scripts/production-env.mjs` supplies the confirmed public operator/contact defaults only to explicit release commands. Normal builds remain previews. Public Workers subdomains and version URLs are disabled in Wrangler configuration to avoid duplicate indexed copies.

Submit `https://makeatimer.com/sitemap.xml` after verifying domain ownership in Search Console. Submission is separate from indexing or ranking. Optional analytics requires a deliberate integration and a matching privacy update; no analytics script is included by default.

## Advertising activation

Advertising is off until explicitly enabled. An approved publisher/site and an installed Google-certified consent management platform (CMP) are required. Never enable the flags merely to show empty ad boxes.

Configure `PUBLIC_ADS_CLIENT` with the actual `ca-pub-…` identifier and the three manual slot IDs (`PUBLIC_ADS_SIDE_SLOT`, `PUBLIC_ADS_RESULT_SLOT`, `PUBLIC_ADS_CONTENT_SLOT`). Install the CMP's real loader/configuration according to its documentation and Google account settings. Have its adapter dispatch:

```js
window.dispatchEvent(
  new CustomEvent('makeatimer:ad-consent', {
    detail: { permitted: true }, // only after the certified CMP permits advertising
  }),
);
```

Dispatch `permitted: false` on refusal or revocation. Resolve the initial persisted consent state after the page handler is registered. Listen for `makeatimer:open-consent` to open the CMP preference manager from the footer. The adapter must honor the CMP/Google advertising mode; this site does not interpret raw TCF strings or supply a homemade consent banner.

Set `PUBLIC_CMP_READY=true` only after testing this real integration. Then set `PUBLIC_ADS_ENABLED=true`. The generated `ads.txt` uses the configured publisher ID. The privacy page describes advertising only in enabled builds.

Manual units have reserved space, load asynchronously after permission, and are filled at most once per page. Active, paused, and fullscreen timing views hide all placements. Ad refusal/revocation clears placements and reloads a previously loaded ad page so the CMP can resolve the new state. Tools remain usable when scripts fail or are blocked. No automatic refresh, floating anchors, overlays, or vignettes are configured here; keep account-side automatic formats off too.

Verify enabled layouts using stubbed requests/consent events before activation. Never click the operator's live ads. AdSense approval and serving are separate from deployment. Use `PUBLIC_ADS_ENABLED=false` and redeploy to disable advertising centrally.

## Release and rollback

Run `npm run release-check` after staging the reviewed public files and building production output. Review the complete file list and Git history yourself; the automated credential scan only catches common patterns. Use GitHub noreply addresses for all author/committer metadata before the first public push.

Keep the previous known-good Cloudflare deployment available. Roll back to that version if functional or advertising behavior regresses, then verify the homepage, a calculator, share links, robots, and ad state. Keep account recovery references and operational records outside the public repository.
