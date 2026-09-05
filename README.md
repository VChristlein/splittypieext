# SplittyPie

[![Build Status](https://github.com/VChristlein/splittypieext/workflows/Tests/badge.svg)](https://github.com/VChristlein/splittypieext/actions?query=workflow%3ATests)

SplittyPie is an offline-first Ember application. It's mobile friendly and
follows [Progressive Web App concept.](https://developers.google.com/web/progressive-web-apps/)

## New in this fork

This fork ([VChristlein/splittypieext](https://github.com/VChristlein/splittypieext)) extends the
original SplittyPie with:

* **Per-user factors** &mdash; assign each person a weight (e.g. `0.5` for a child, `3` for a
  family entered as one person) used to split expenses proportionally instead of always evenly.
* **Per-transaction factor control** &mdash; an "Obey factors" toggle to fall back to an even
  split for a single expense, plus the ability to override any participant's factor just for that
  one transaction.
* **Donations** &mdash; a single contributor's money credited to everyone it's split among (by
  weight), for things like chipping in on a birthday gift.
* **Deposits** &mdash; record several people's individual prepayments directly (no splitting),
  optionally directed at one person collecting the money (e.g. for a flat booking).
* **Itemized expenses** &mdash; split a bill by exact amount per person instead of by weight, when
  everyone owes a different, known amount.
* **Multiple amounts per transaction** &mdash; enter several individual purchases (e.g. a family's
  separate shopping trips) under one transaction, automatically summed.
* **Per-transaction currency** &mdash; pay for a single expense in a different currency than the
  event's own. The exchange rate is fetched automatically (via the free
  [Frankfurter](https://frankfurter.dev) API) and can be overridden manually; amounts are shown in
  both currencies.
* **Excel export** &mdash; download an event's full transaction history and closing balances as a
  `.xlsx`, with live formulas (not just static numbers) so the sheet stays correct if you tweak a
  value.
* **English/German language switcher** &mdash; a language toggle in the side menu; German also
  formats numbers the German way (`1.234,56` instead of `1,234.56`).
* **Working cross-device sync** &mdash; the original project's bundled Firebase SDK (2016-era)
  couldn't talk to modern Firebase databases at all, so an event created on one device silently
  never reached anyone else. Upgraded to a current SDK; opening a shared event link on a different
  device or browser now actually works.

See the rest of this README for the original project's setup and usage instructions.

## Prerequisites

You will need the following things properly installed on your computer.

* [Git](http://git-scm.com/)
* [Node.js](http://nodejs.org/) (with NPM)
* [Ember CLI](http://www.ember-cli.com/)
* [Chrome](https://www.google.com/chrome/) or [Chromium](https://www.chromium.org/) (used headless to run tests)

## Installation

* `git clone <repository-url>` this repository
* change into the new directory
* `npm install` &mdash; a `postinstall` step also patches a small build-config incompatibility
  between `emberfire` and the current Firebase SDK version (see `fix-emberfire-vendor-entry.js`);
  it's idempotent and safe to ignore unless it prints a warning

## Running / Development

* `ember server`
* Visit your app at [http://localhost:4200](http://localhost:4200).

### Code Generators

Make use of the many generators for code, try `ember help generate` for more details

### Running Tests

* `npm test` &mdash; starts a local Firebase Realtime Database emulator (needed by the
  acceptance/synchronization tests) before running the suite, and stops it afterwards
* `ember test` / `ember test --server` &mdash; runs the suite directly, without the emulator; fine
  for unit/integration tests, but acceptance tests that talk to the database will hang and fail

### Building

* `ember build` (development)
* `ember build --environment production` (production)

### Deploying

This fork deploys to [Firebase Hosting](https://firebase.google.com/docs/hosting), with Firebase
Realtime Database as the backend, via `firebase-tools`.

1. Create a Firebase project (Hosting + Realtime Database enabled) and update `.firebaserc` and
   `firebase.json`'s `hosting.site` to match it.
2. Log in once with `node_modules/.bin/firebase login`.
3. Deploy with one of:
   * `npm run deploy` &mdash; dev environment
   * `npm run deploy:staging` &mdash; staging environment
   * `npm run deploy:prod` &mdash; production environment
   * `npm run deploy:offline` &mdash; offline-only environment

Each of these builds the app and pushes it to the matching Firebase project in one step. If
you're on a very recent Node.js version and see `firebase`/`firebase-server` crash on startup,
see `node-legacy-shim.js` at the repo root &mdash; it's already wired into these scripts (and into
`npm test`) via `NODE_OPTIONS`, so this only matters if you're calling the Firebase CLI directly.

## Further Reading / Useful Links

* [ember.js](http://emberjs.com/)
* [ember-cli](http://www.ember-cli.com/)
* Development Browser Extensions
  * [ember inspector for chrome](https://chrome.google.com/webstore/detail/ember-inspector/bmdblncegkenkacieihfhpjfppoconhi)
  * [ember inspector for firefox](https://addons.mozilla.org/en-US/firefox/addon/ember-inspector/)
