# Static deployment

Build with `npm ci` followed by `npm run verify`. Deploy only `dist/`. The supplied `wrangler.jsonc` configures static assets, directory-style URLs, and the 404 page; there is no runtime Worker or backend service.

The current workflow verifies changes in GitHub Actions and deploys from the Wrangler CLI. GitHub verification does not deploy the site. Use an existing Wrangler login or a scoped deployment credential kept outside the repository.

Run from the repository root:

```sh
npm ci
npm run verify
npx playwright install chromium firefox webkit
npm run browser-check
npm run ad-check
npm run build:production
npm run deploy
```

`verify` creates a noindex preview for browser checks. The final production build enables indexing, and `deploy` refuses preview output. Wrangler is pinned in the lockfile.

Cloudflare Workers Builds is an optional alternative. Use `main`, build with `npm ci && npm run check && npm test && npm run build:production`, and deploy with `npm run deploy`. Configure the required production variables and a deployment credential with permissions limited to the intended service. Connecting a managed build is separate from this repository's verification workflow.

## Production configuration

Set `PUBLIC_LAUNCH_READY=true`, `PUBLIC_OPERATOR_NAME` to the confirmed legal operator name, and `PUBLIC_CONTACT_EMAIL` to the public contact address. Build and review About, Contact, Privacy, and Terms. The build refuses indexing without those values. Preview/PR environments must use `PUBLIC_LAUNCH_READY=false`; their robots file disallows crawling and every page uses noindex.

Configure `makeatimer.com` as the custom domain. In Cloudflare, configure an HTTPS redirect from `www.makeatimer.com/*` to `https://makeatimer.com/$1`, preserving the path and query. Do not add an application Worker for this redirect. Verify TLS, redirects, real 404s, canonicals, robots, and the sitemap after deployment.

`scripts/production-env.mjs` supplies the confirmed public operator/contact defaults only to explicit release commands. Normal builds remain previews. Public Workers subdomains and version URLs are disabled in Wrangler configuration to avoid duplicate indexed copies.

Submit `https://makeatimer.com/sitemap.xml` after verifying domain ownership in Search Console. Submission is separate from indexing or ranking. Optional analytics requires a deliberate integration and a matching privacy update; no analytics script is included by default.

## Advertising activation

Advertising is off until explicitly enabled. An approved publisher/site and an installed Google-certified consent management platform (CMP) are required. Never enable the flags merely to show empty ad boxes.

For AdSense ownership verification before approval, set `PUBLIC_ADS_CLIENT` to the existing publisher's actual `ca-pub-…` identifier and use an explicit production build. The root `ads.txt` then publishes the authorized seller record even while advertising stays disabled. Select the ads.txt verification method in AdSense, verify the live file, and request site review. Preview builds and builds without a valid publisher ID keep the disabled placeholder. Publishing this seller record does not load advertising scripts or enable ad placements.

Configure `PUBLIC_ADS_CLIENT` with the actual `ca-pub-…` identifier. Publish the three-choice European regulations message in Google's Privacy & messaging for this site, with the correct site name and privacy-policy URL. Set `PUBLIC_CONSENT_ENABLED=true` in a production build to deploy the message through Google's AdSense base tag while keeping `PUBLIC_ADS_ENABLED=false`. Keep account-side Auto ads and Auto optimize OFF. Loading the base tag for consent does not create manual units or push ad requests; only the advertising controller can fill this site's reserved units after permission and activation. No ad-block recovery message or error-protection overlay is configured. The footer's Privacy choices button reopens Google's message where European choices apply.

The built-in adapter follows [Google's JavaScript API](https://developers.google.com/funding-choices/fc-api-docs) and subscribes to the structured IAB TCF event API. Unknown/error states keep ads blocked. In European regions it requires resolved storage consent (Purpose 1) and Google vendor consent (755). AdSense reads the CMP's full TC string itself to determine its permitted advertising mode. The site does not decode TC strings or provide a homemade banner. Opening preferences suspends further requests and hides placements until the new choice is resolved; refusing after ads loaded clears placements and reloads the page.

If Google does not deliver a usable message or reopen preferences within 30 seconds, the footer reports that privacy settings could not load and disables the unusable control. Tools remain available and the advertising gate stays closed. A later valid CMP response can recover. Once the CMP reports its UI open, the adapter gives the visitor unlimited time to decide. Initial API readiness and passing fixture tests do not prove that Google's real message appears.

Configure the three manual slot IDs (`PUBLIC_ADS_SIDE_SLOT`, `PUBLIC_ADS_RESULT_SLOT`, `PUBLIC_ADS_CONTENT_SLOT`) before advertising activation. For an alternative certified CMP, replace the Google adapter and have it dispatch:

```js
window.dispatchEvent(
  new CustomEvent('makeatimer:ad-consent', {
    detail: { permitted: true }, // only after the certified CMP permits advertising
  }),
);
```

An alternative adapter must dispatch `permitted: false` on refusal or revocation, resolve initial persisted consent after the handler is registered, and connect the footer's preference button to its own manager. Honor the CMP/Google advertising mode.

Test the real message on the production domain, including consent, refusal, saved choices, and preference reopening/revocation. Google's documented `?fc=alwaysshow&fctype=gdpr` URL previews the published message. Automated checks use a stubbed CMP and ad responses; they never request real ads. Set `PUBLIC_CMP_READY=true` only after real integration checks pass and set `PUBLIC_ADS_ENABLED=true` only after publisher/site approval. Set the activation flag in the shell or managed build environment: the explicit release commands default `PUBLIC_ADS_ENABLED` to `false`, overriding an `.env`-only activation value. The privacy page describes consent messaging independently of ad activation. Default preview builds load neither messaging nor ads.

Manual units have reserved space, load asynchronously after permission, and are filled at most once per page. Active, paused, and fullscreen timing views hide all placements. Ad refusal/revocation clears placements and reloads a previously loaded ad page so the CMP can resolve the new state. Tools remain usable when scripts fail or are blocked. No automatic refresh, floating anchors, overlays, or vignettes are configured here; keep account-side automatic formats off too.

Verify enabled layouts using stubbed requests/consent events before activation. Never click the operator's live ads. AdSense approval and serving are separate from deployment. Use `PUBLIC_ADS_ENABLED=false` and redeploy to disable advertising centrally.

## Release and rollback

Run `npm run release-check` after staging the reviewed public files and building production output. Review the complete file list and Git history yourself; the automated credential scan only catches common patterns. Use GitHub noreply addresses for all author/committer metadata before the first public push.

Keep the previous known-good Cloudflare deployment available. Roll back to that version if functional or advertising behavior regresses, then verify the homepage, a calculator, share links, robots, and ad state. Keep account recovery references and operational records outside the public repository.
