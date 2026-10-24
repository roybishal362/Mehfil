# How Mehfil uses Gemini

Gemini does the work that needs judgement and language: reading a description, tailoring a plan
to a culture and a budget, suggesting ideas, proposing edits and writing invitations. Plain code
does everything that must be exact: amounts, dates, totals and links. Every call goes through the
server; the browser never holds a key.

## The five tasks

| Task                 | Endpoint                                   | Model (default)                                                                  | What Gemini returns                                                                                                     | What code does with it                                                                                                                    |
| -------------------- | ------------------------------------------ | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Read a description   | `POST /api/ai/brief`                       | `gemini-3.5-flash-lite`, minimal thinking                                        | Structured fields: occasion, date, city, guests, budget, styles, food, needs                                            | Validates and prefills the form; a local parser already shows what it understood while you type                                           |
| Tailor a plan        | `POST /api/ai/personalize` (NDJSON stream) | Budget, timeline and vendors: `gemini-3.5-flash-lite`; ideas: `gemini-3.5-flash` | Budget percentages with reasons, extra tasks as day offsets, run-sheet slots, risks, vendor advice, ideas and a summary | Turns percentages into amounts that add up exactly, offsets into dates before the event, then merges each section as it arrives           |
| Refine ideas         | `POST /api/ai/refine`                      | `gemini-3.5-flash`, low thinking                                                 | New ideas following "more budget-friendly" or your own words                                                            | Keeps the ideas you marked, replaces the rest                                                                                             |
| Copilot              | `POST /api/ai/copilot`                     | `gemini-3.5-flash`, low thinking, function calling                               | Calls to ten tools such as `add_task`, `set_guest_count` or `set_budget_line`                                           | Converts each call into a typed `PlanOperation`, drops any that point at unknown IDs, and shows a before-and-after list the user approves |
| Write the invitation | `POST /api/ai/invitation`                  | `gemini-3.5-flash-lite`, minimal thinking                                        | Two or three versions in the chosen tone, channel and language                                                          | Cleans the text and offers copy and WhatsApp share                                                                                        |

Models are set by environment variables (`GEMINI_MODEL_SMART`, `GEMINI_MODEL_FAST`) and reported
by `/api/health`. The defaults were chosen by measurement on the free tier (`evals/models.ts`):
`gemini-3.5-flash` returned the ideas section in about 5 seconds, while `gemini-3.7-flash`,
`gemini-3.8-flash` and `gemini-flash-latest` timed out at the 25-second section limit. The calls use `@google/genai` `models.generateContent` with
`responseMimeType: application/json` and a `responseJsonSchema` generated from the same Zod
schemas the app uses (`src/server/ai/json-schema.ts` keeps only the keywords Gemini supports).

## Guardrails

1. **Untrusted input stays data.** Descriptions and instructions are escaped and wrapped in
   `<user_input>` blocks; the system instructions say such text is information, never
   instructions (`src/server/ai/prompts.ts`).
2. **Structured output only.** Every answer must parse as JSON, match the Zod schema, and stay
   within bounds (lengths, counts, percentages, day offsets). Anything else is rejected and the
   deterministic section stays in place.
3. **Diets are spelled out.** Every section prompt states what each requested diet rules out
   (for example, Jain means no onion, garlic, potato or other root vegetables), because a bare
   "respect the dietary needs" occasionally let a wrong dish through.
4. **No invented facts.** The schemas have no fields for vendor names, phone numbers or prices.
   A post-filter strips phone numbers, email addresses and links from every string. Real vendors
   are found through Google Maps search links built by code for each category and city.
5. **The Copilot proposes, the user decides.** Tool calls become typed operations validated by
   `PlanOperation`; operations on unknown IDs are dropped and reported. Applying them is one
   undoable step. Gemini often answers with tool calls and no text: the panel then says what came
   with the answer ("I suggest 2 changes."), and later turns remind Gemini of what it proposed, so
   a follow-up such as "make it 80 instead" works. Turns from one side in a row (after a failed
   request) are joined, so Gemini always sees a conversation that alternates.
6. **Privacy.** Guest names and contacts never leave the device for the AI; the prompts get
   counts only. The footer tells users that the free Gemini tier may use event details to improve
   Google's products.

## Resilience on the free tier

- A **response cache** (SHA-256 of prompt version, task, model and prompt) answers repeated
  requests, such as several visitors trying the same sample, from memory.
- A **request budget per model** keeps the server under the free-tier per-minute limit and fails
  fast instead of collecting `429`s.
- **Fallbacks:** one jittered retry, then the other model, then the deterministic plan, all within
  one deadline. A **circuit breaker** pauses a failing model and lets one trial request through when
  it reopens.
- **Section isolation:** the four personalisation sections run in parallel and stream back
  independently, so a slow or failed section never holds up the others, and it can be retried on
  its own.
- **Demo mode:** without a key, a mock provider returns realistic answers with the same shapes,
  marked with a banner. All automated tests use it, so they are fast, free and repeatable.

## Evidence

- `npm run eval` (`evals/run.ts`) runs six sample celebrations against real Gemini, including
  descriptions in Hindi and Bengali, a Jain dinner and a short-notice party. On 24 October 2026
  every sample passed every check: valid structured answers from Gemini for all four sections,
  budgets that add up, dates before the event, no contact details, diets respected and text in
  the requested language. `evals/models.ts` times candidate models on the heaviest task.

- `src/server/app.test.ts`: the whole API with a scripted provider, including hostile model
  output (bad JSON, out-of-range values, injected instructions, invented phone numbers).
- `src/server/ai/gateway.test.ts`: cache, fallback, circuit breaker, request budget, deadline.
- `src/server/ai/prompts.test.ts`, `src/server/ai/mock-and-tasks.test.ts`: prompts and sanitising.
- `src/shared/domain/merge.test.ts`: merging AI sections into a plan.
- `e2e/plan.spec.ts`: the full journey in a real browser, including Copilot apply and undo.
