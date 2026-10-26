# 6. Small functions, held by lint

**Status:** accepted · 27 October 2026

## Context

The code grew feature by feature, and a few functions grew with it. Edits to a plan went through
one switch over 26 kinds of edit in a 338-line file. The AI gateway's fallback loop handled circuit
breakers, deadlines and logging in one place. Some components held a whole form with its requests.
Long functions are harder to review and to test, and they hide the one line a change needs.

## Decision

- Lint holds every source function to at most 80 lines, complexity 10 (a `switch` counts once),
  four parameters, three levels of nesting and three levels of nested callbacks. The rules are the
  `mehfil/small-functions` block in `eslint.config.js`. Tests are exempt: each reads best as one
  story, from setup to expectation.
- Functions are split by meaning: a pure helper, or a lookup table instead of a chain of branches;
  a hook for a component's state and requests; a named sub-component for each part of a screen.
- Plan edits are applied by one module per part of the plan (`src/shared/domain/ops/`).
  `applyOperation` only dispatches to them.

## Consequences

- Every function fits on a screen and does one job, which its name states.
- The splits changed no behaviour. The same unit, component (with axe) and browser tests pass
  before and after, and the rendered markup is the same.
- Some data stays long on purpose, such as templates and translations. The rule covers functions,
  not files.
- More, smaller components mean more of the React Compiler's memo checks, which coverage counts as
  branches. Client branch coverage therefore reads lower than in the shared and server code, which
  the compiler does not touch.
