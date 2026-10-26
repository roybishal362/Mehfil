# Working on Mehfil (for AI coding agents and new contributors)

Mehfil is a GenAI celebration planner: React 19 + Vite in the browser, a Hono AI gateway on
Node.js 24 (Vercel), Gemini through `@google/genai`, and Firebase (Auth + Firestore) for optional
sync and share links. Read `docs/ARCHITECTURE.md` first.

## Commands

| Task                                 | Command                                                     |
| ------------------------------------ | ----------------------------------------------------------- |
| Install                              | `npm ci` (Node 22.12+; CI uses 22 and 24)                   |
| Develop (API on 8787, web on 5173)   | `npm run dev`                                               |
| Lint, types, formatting              | `npm run lint`, `npm run typecheck`, `npm run format:check` |
| Tests with coverage gates            | `npm run test:coverage`                                     |
| Production build and browser tests   | `npm run build`, then `npm run e2e`                         |
| Firestore rules and Firebase adapter | `npm run test:rules` (Java 21)                              |

Without `GEMINI_API_KEY` the server runs a deterministic mock provider (demo mode), which is also
what every automated test uses.

## Rules of the codebase

1. **AI suggests, code computes.** Never let the model produce money, dates or contacts. Add a
   bounded field to the schema in `src/shared/schemas/ai.ts` and compute in `src/shared/domain`.
2. **One mutation path.** Change plans only with `PlanOperation`s through the plans store
   (`apply`) or `transform` for AI merges. Revisions must only increase.
3. **Schemas are the contract.** Zod schemas in `src/shared/schemas` drive validation on both
   sides and Gemini's JSON schema. Import Zod only as `import * as z from '…/shared/zod'`
   (a lint rule enforces it; it keeps Zod's `eval` path off for the Content-Security-Policy).
4. **No inline scripts or styles.** The CSP is strict. The prerendered home page must not contain
   `style="…"` attributes; put placement and timing in CSS.
5. **Every visible string is translated.** Add it to `src/client/i18n/en.ts`; TypeScript then
   requires it in `hi.ts` and `bn.ts`. Pass formatted numbers and dates into message functions.
6. **Accessible by default.** Label every control, keep focus management intact, never use colour
   alone, and keep pages from scrolling sideways. Component tests run axe; browser tests run axe and
   a reflow check.
7. **Privacy.** Guest names and contacts never go to the AI; share snapshots are built from a
   whitelist (`src/shared/export/share.ts`).
8. **Tests come with changes.** Unit tests sit next to the code (`*.test.ts(x)`); journeys live
   in `e2e/`; rules tests in `tests/`.
9. **Motion is decoration.** Nothing that carries information moves, and everything stops under
   `prefers-reduced-motion` (moments never play then). Loops get the `.motion` class so they wait
   for the page to load. Name the keyframes in every `animation` shorthand: the CSS minifier turns
   a shorthand without a name into `animation: none`.
10. **Occasions come from data.** A plan's look comes from `moodFor()` in
    `src/shared/domain/mood.ts`; give a new mood its tokens in `tokens.css` (the contrast test
    covers them), its photographs in `src/client/photos` and, if it has one, a moment in
    `features/moments`.
11. **Photographs, not pictures.** The look comes from real, openly licensed photographs in
    `src/client/photos` (4:5 arch photos in 240, 480 and up to 720 pixels; 16:10 moment photos),
    never emoji or clip-art. Draw them with `<Photo>` inside `<Arch>`, which gives them empty alt
    text and a reserved size; only the first screen's photo takes `priority`. Credit every new
    photo in `credits.ts` and `CREDITS.md`; `scripts/photo-budget.test.ts` keeps each file under
    150 KB.
12. **Small functions.** Lint holds source functions to 80 lines, complexity 10, four
    parameters and three levels of nesting (tests are exempt). Split by meaning: a pure helper or
    a lookup table, a hook for state and requests, or a named sub-component. See ADR 6.

## Writing style

Code comments and user-facing text use plain, specific words and short sentences. Explain why,
not what. Keep comments up to date when the code changes.
