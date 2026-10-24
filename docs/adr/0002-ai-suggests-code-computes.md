# 2. AI suggests, code computes

**Status:** accepted · 23 October 2026

## Context

Language models are good at tailoring and wording and bad at arithmetic and dates. Plans contain
money and deadlines that people act on, and an AI plan that does not add up, or that invents a
vendor's phone number, is worse than no plan.

## Decision

- A deterministic engine (`src/shared/domain`) builds a complete baseline plan instantly from the
  brief and owns every number and date.
- Gemini returns structured, bounded suggestions: budget percentages with reasons, tasks as day
  offsets, run-sheet slots, risks, vendor advice, ideas and wording. The engine converts and merges
  them; schemas have no fields for vendor names, contacts or prices.
- Every change, from a form, an AI merge or the Copilot, is a typed `PlanOperation` applied by one
  pure function. The Copilot can only propose operations; the user applies them.

## Consequences

- Budgets always add up exactly and dates are always valid, which property-based tests check.
- The app is useful when Gemini is slow, rate-limited or down: the baseline is already there, and
  each AI section arrives on its own.
- Undo, redo, sync and the Copilot share one mutation path, so there is one place to test.
