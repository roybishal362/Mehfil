# 4. Local-first plans, with opt-in sync through Google sign-in

**Status:** accepted · 24 October 2026

## Context

People plan celebrations over months, on a phone and a laptop, sometimes offline. Guest lists
hold personal data. The free Firestore tier has daily read and write quotas.

## Decision

- Plans are always saved in the browser first; saving never waits for the network.
- Syncing is opt-in: signing in with Google copies plans to `users/{uid}/plans` in Firestore
  through `firebase/firestore/lite` (plain HTTPS, loaded only when needed). Anonymous sign-in is
  used silently only where an account is needed anyway: AI calls on a server that requires one,
  and share links.
- Each plan has a revision that only increases. Each device remembers the revision it last
  synced. Pushes are transactions that succeed only if the cloud copy still has that revision;
  otherwise a full sync runs a pure `reconcile` step that copies one-sided changes, follows
  deletions unless the other side kept working, and asks the user about real conflicts.

## Consequences

- No silent upload of guest lists; the account dialog states where data lives and can delete it.
- Changes made offline are simply "not yet synced" and go up when the connection returns.
- Sync costs one read and one write per changed plan, plus a list when a tab comes back into view
  at most every 30 seconds, well within the free quota.
- Rejected: the full Firestore SDK with realtime listeners (much larger bundle, persistent
  connection) and last-write-wins (loses work on two devices).
