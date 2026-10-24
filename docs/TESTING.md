# Testing

Four layers, all runnable locally and in CI. AI calls use a deterministic mock provider, so every
test is fast, free and repeatable.

| Layer                           | Command                                            | Count                   | What it covers                                                                                         |
| ------------------------------- | -------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------ |
| Unit, integration and component | `npm test` (`npm run test:coverage` for the gates) | 680 tests in 55 files   | Planning engine, AI gateway and API, client state, sync, every page and section with axe               |
| Firebase emulators              | `npm run test:rules` (needs Java 21)               | 13 tests                | Firestore Security Rules and the Firebase adapter against the Auth and Firestore emulators             |
| Browser journeys                | `npm run e2e` (after `npm run build`)              | 19 journeys × 2 devices | Real Chromium on desktop and a Pixel 7, with axe on every page and reflow checks at 390 and 320 px too |
| Lighthouse                      | `npx @lhci/cli@0.15.1 autorun` (CI)                | 2 pages × 3 runs        | Accessibility 100 and best practices ≥ 95 enforced; performance and SEO tracked                        |

Coverage on the last run: **97.3 % of lines, 88.5 % of branches, 95.5 % of functions**. CI fails
if the shared engine or the server drop below 90 % of lines, or the client below 80 %.

## What each layer proves

**Planning engine (`src/shared`).** Budgets always add up to the total (largest-remainder
rounding, checked with property-based tests), tasks are scheduled before the event and pulled
forward when time is short, leap days and multi-day events work, every operation keeps the plan
valid, AI merges keep the user's own changes, and exports are correct (`.ics` escaping, line
folding and reminders; Google Calendar and Maps links; CSV round trips with formula-injection
protection; share snapshots without personal data).

**Server (`src/server`).** The whole API through `app.request()` with a scripted provider:
validation errors (400, 413, 415), rate limits (429 with `Retry-After`), Firebase token checks
(401), security headers on every response, the NDJSON stream with partial failures, the cache,
fallback chain, circuit breaker and request budget, hostile model output (bad JSON, out-of-range
numbers, injected instructions, invented phone numbers) and log privacy.

**Client (`src/client`).** Every page and plan section renders and passes axe in both themes; the
form's error summary takes focus; budget, timeline, vendors, ideas, guests and Copilot edits go
through the store with undo; the prerendered home page has no inline styles and hydrates without
mismatches; the sync engine copies changes, follows deletions, survives going offline and asks
about conflicts (with a property-based test that no changed plan is ever dropped); share links
never include guest details; the account and share dialogs work end to end against an in-memory
Firebase.

**Security rules (`tests/firestore.rules.test.ts`).** Only owners can read or write their plans;
documents must have exactly the expected fields, types, sizes and server timestamps; share links
can be read until they expire, cannot be listed except by their owner, and only the owner can
change or delete them; everything else is denied.

**Browser journeys (`e2e/`).** The home page arrives prerendered and reads a description as you
type; a plan made from one sentence is tailored section by section; the budget rebalances; a task
is ticked off and the calendar file downloads with reminders; vendor quotes are kept; ideas are
refined; a Copilot proposal is applied and undone; guests are added and an invitation is written;
everything survives a reload; language and theme are remembered; the step-by-step form explains
missing fields; unknown pages explain themselves; the whole flow works with the keyboard alone.
Every test also fails on any console error, uncaught exception or Content-Security-Policy
violation.

## Running everything

```
npm ci
npm run lint && npm run typecheck && npm run test:coverage
npm run build && npm run e2e
npm run test:rules   # requires Java 21 for the Firebase emulators
```
