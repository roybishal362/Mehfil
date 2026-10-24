# 3. `generateContent` with JSON schemas, behind a provider interface

**Status:** accepted · 23 October 2026

## Context

`@google/genai` offers `models.generateContent` (stable) and the newer Interactions API (beta in
places). Mehfil needs structured output for four plan sections, function calling for the
Copilot, and a way to run every test without the network.

## Decision

- Call `models.generateContent` with `responseMimeType: application/json` and a
  `responseJsonSchema` generated from the app's Zod schemas, reduced to the keywords Gemini
  supports (`src/server/ai/json-schema.ts`). The Copilot uses function declarations.
- Hide the SDK behind an `AiProvider` interface with two implementations: Gemini, and a
  deterministic mock that returns realistic answers with the same shapes.

## Consequences

- One schema definition drives validation in the browser, on the server and in Gemini's output.
- Switching to another API or model family changes one file.
- All automated tests, the browser journeys and the key-less demo use the mock provider, so they
  are fast, free and repeatable; a manual evaluation script exercises the real model.
