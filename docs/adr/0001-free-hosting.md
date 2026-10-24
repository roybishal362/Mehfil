# 1. Free hosting: Vercel Hobby, Firebase Spark and the Gemini free tier

**Status:** accepted · 23 October 2026

## Context

The app must stay online for judging and afterwards at no cost, with no billing account. It needs
static hosting close to Indian users, a server that keeps the Gemini key secret and can stream,
sign-in and a database.

## Decision

- **Vercel Hobby** serves the client from its CDN and runs the Hono gateway as one Node.js 24
  function in `bom1` (Mumbai) with streaming responses, through the Build Output API.
- **Firebase Spark** provides Authentication (anonymous and Google) and Cloud Firestore, protected
  by Security Rules.
- **Google AI Studio's free tier** provides the Gemini key, used only on the server.

Rejected: Cloud Run and Secret Manager (need billing), Render's free tier (instances sleep, about
50 seconds of cold start), Vertex AI and search grounding (need billing).

## Consequences

- Free-tier Gemini limits are real, so the gateway caches, budgets requests per model, falls back
  to the other model and finally to the deterministic plan (ADR 2).
- The app must work without Firebase and without a key, so one build reads its capabilities from
  `/api/config` at runtime and degrades to local-only and demo mode.
- The same app also runs as a plain Node server or a distroless container, so moving to a paid
  host later is a configuration change.
