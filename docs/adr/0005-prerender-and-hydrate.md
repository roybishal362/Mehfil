# 5. Prerender the home page and hydrate it

**Status:** accepted · 24 October 2026

## Context

The home page is a drawn scene (sky, lanterns, rangoli) and the first thing judges and visitors
see. As a client-only React app it painted only after about 150 KB of JavaScript had downloaded
and run: Lighthouse measured first paint at 3.6 seconds on a simulated phone.

## Decision

- At build time, render the English home page to HTML (`src/client/prerender.tsx`,
  `scripts/prerender.ts`) and put it in `index.html`.
- In the browser, hydrate that HTML inside a React transition, so the work is split into short
  slices. Other pages and languages, which the snapshot does not match, are hidden by a tiny
  script before paint and rendered on the client instead.
- Keep the snapshot compatible with the strict Content-Security-Policy: no inline `style`
  attributes (placement and timing of decorations moved to CSS), and Zod without `eval`.
- State that differs on a returning visit (saved plans, the day theme) uses the stores' initial
  values during hydration and updates right after, so hydration never mismatches.

## Consequences

- The festive first screen paints from HTML and CSS; with the font work alongside, Lighthouse
  performance rose from 62 to 87–90 on a simulated phone, and best practices to 100.
- Tests guard both rules: the prerendered HTML has no `style=` attributes, and hydrating it for
  a first or returning visitor logs no mismatch.
