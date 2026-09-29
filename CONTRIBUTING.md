# Contributing

Install dependencies with `npm ci` and run `npm run dev`. Keep calculations in the shared modules and add independent reference cases for changes to numerical or calendar behavior. Register page metadata, fields, examples, and related links in `src/lib/tools.ts`.

Before proposing a change, run `npm run verify` and `npm run browser-check`. Use explicit input labels, keyboard-accessible controls, and useful error messages. Avoid external services for calculations and do not add account or tracking requirements.

Describe the user-visible behavior and relevant validation in the pull request. Never include credentials, browser profiles, local logs, or private project planning. Advertising tests must use stubs and must never click live ads.
