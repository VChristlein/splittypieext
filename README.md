# SplittyPie

[![Build Status](https://github.com/cowbell/splittypie/workflows/Tests/badge.svg)](https://github.com/cowbell/splittypie/actions?query=workflow%3ATests)
[![Code Climate](https://codeclimate.com/github/cowbell/splittypie/badges/gpa.svg)](https://codeclimate.com/github/cowbell/splittypie)

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

See the rest of this README for the original project's setup and usage instructions.

## Prerequisites

You will need the following things properly installed on your computer.

* [Git](http://git-scm.com/)
* [Node.js](http://nodejs.org/) (with NPM)
* [Ember CLI](http://www.ember-cli.com/)
* [PhantomJS](http://phantomjs.org/)

## Installation

* `git clone <repository-url>` this repository
* change into the new directory
* `npm install`

## Running / Development

* `ember server`
* Visit your app at [http://localhost:4200](http://localhost:4200).

### Code Generators

Make use of the many generators for code, try `ember help generate` for more details

### Running Tests

* `ember test`
* `ember test --server`

### Building

* `ember build` (development)
* `ember build --environment production` (production)

### Deploying

Specify what it takes to deploy your app.

## Further Reading / Useful Links

* [ember.js](http://emberjs.com/)
* [ember-cli](http://www.ember-cli.com/)
* Development Browser Extensions
  * [ember inspector for chrome](https://chrome.google.com/webstore/detail/ember-inspector/bmdblncegkenkacieihfhpjfppoconhi)
  * [ember inspector for firefox](https://addons.mozilla.org/en-US/firefox/addon/ember-inspector/)
