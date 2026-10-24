# Deployment

Mehfil runs entirely on free tiers: **Vercel Hobby** serves the app and the AI gateway, **Firebase
Spark** provides sign-in and the database, and a free **Google AI Studio** key powers Gemini. No
card or billing account is needed anywhere.

Without Firebase the app still works fully (plans are saved in the browser); the account button,
sync and share links simply don't appear. Without a Gemini key the server runs in a labelled demo
mode with sample AI answers.

## 1. Gemini (Google AI Studio)

1. Open [Google AI Studio → API keys](https://aistudio.google.com/apikey) and create a key.
2. For local development, paste it after the `=` in `.env.local` at the project root (git
   ignores this file; never put the key in `.env.example`, which is published):

   ```
   GEMINI_API_KEY=
   ```

3. For Vercel, add it as an environment variable (step 3). The key is read only by the server
   function; it is never sent to the browser.

The free tier has per-minute and per-day limits. The gateway stays under them with a per-model
request budget (`AI_MAX_RPM`), a response cache, a fallback model and a circuit breaker, and it
returns the deterministic plan when Gemini is unavailable.

## 2. Firebase (sign-in, sync, share links)

1. In the [Firebase console](https://console.firebase.google.com/) create a project (the free
   Spark plan is enough). Google Analytics is not needed.
2. **Project settings → Your apps → Web app**: register an app and copy its config
   (`apiKey`, `authDomain`, `projectId`, `appId`). These values are public by design.
3. **Authentication → Sign-in method**: enable **Anonymous** and **Google**.
4. **Authentication → Settings → Authorized domains**: add your Vercel domain
   (for example `mehfil.vercel.app`).
5. **Firestore Database → Create database**: production mode, location `asia-south1` (Mumbai).
6. Deploy the security rules and index settings from this repository:

   ```
   npx firebase-tools@15 login
   npx firebase-tools@15 deploy --only firestore:rules,firestore:indexes --project <project-id>
   ```

   (Or paste `firestore.rules` into **Firestore → Rules** and publish.)

7. Restrict the browser key in [Google Cloud console → Credentials](https://console.cloud.google.com/apis/credentials):
   - **Application restrictions → Websites**: `https://<your-domain>/*` and `http://localhost:*/*`.
   - **API restrictions**: Identity Toolkit API, Token Service API, Cloud Firestore API.

When Firebase is configured, the AI endpoints require a Firebase ID token by default; the app signs
visitors in anonymously behind the scenes, so nobody has to create an account to use the planner.
Set `REQUIRE_AUTH_FOR_AI=false` to turn that off.

## 3. Vercel

1. Push the repository to GitHub and import it in [Vercel](https://vercel.com/new). The settings
   come from `vercel.json` (`npm ci`, then `npm run build:vercel`, which writes the Build Output
   API folder `.vercel/output`).
2. **Settings → Environment Variables** (Production and Preview):

   | Name                   | Value                          | Notes                          |
   | ---------------------- | ------------------------------ | ------------------------------ |
   | `GEMINI_API_KEY`       | your AI Studio key             | Mark as **Sensitive**          |
   | `FIREBASE_PROJECT_ID`  | from the web app config        |                                |
   | `FIREBASE_API_KEY`     | from the web app config        | Public; restricted in step 2.7 |
   | `FIREBASE_AUTH_DOMAIN` | `<project-id>.firebaseapp.com` |                                |
   | `FIREBASE_APP_ID`      | from the web app config        | Optional                       |

3. Deploy. The function runs on Node.js 24 in `bom1` (Mumbai) with streaming responses; static
   files are served from Vercel's CDN with immutable caching for hashed assets.

## 4. Check the live site

- `https://<domain>/api/health` answers `{"status":"ok", ...}` and names the active models.
- Response headers include `Content-Security-Policy` and `Strict-Transport-Security`.
- Describe a celebration in an incognito window: the plan fills in section by section.
- Account button → **Sign in with Google**, then open the site on a phone and sign in again: the
  plan is there.
- **Share** on a plan → open the link in another browser without signing in.
- Run [PageSpeed Insights](https://pagespeed.web.dev/) on the home page.

## Other hosts

The same app runs anywhere Node.js 22+ runs:

```
npm ci && npm run build
PORT=8080 node dist/server/node.mjs
```

The `Dockerfile` builds a distroless, non-root image of exactly that (Cloud Run, Render, Fly.io).
The Node server serves the precompressed (Brotli and gzip) client files itself.

## Environment variables

| Name                  | Default                          | Purpose                                                           |
| --------------------- | -------------------------------- | ----------------------------------------------------------------- |
| `GEMINI_API_KEY`      | none                             | Gemini key. Without it the server runs in demo mode.              |
| `AI_PROVIDER`         | `gemini` with a key, else `mock` | Force `mock` for demos and tests.                                 |
| `GEMINI_MODEL_SMART`  | `gemini-3.8-flash`               | Ideas, refinements and the Copilot.                               |
| `GEMINI_MODEL_FAST`   | `gemini-3.5-flash-lite`          | Briefs, budgets, timelines, vendors, invitations.                 |
| `AI_MAX_RPM`          | `12`                             | Gemini calls per minute per model, per server instance.           |
| `AI_RATE_LIMIT`       | `24`                             | AI tokens per visitor per 10 minutes (a full plan costs about 5). |
| `FIREBASE_*`          | none                             | Public web config; enables the cloud features.                    |
| `REQUIRE_AUTH_FOR_AI` | `true` with Firebase             | Require a Firebase ID token on AI calls.                          |
| `PORT`                | `8787`                           | Node server port.                                                 |
| `LOG_LEVEL`           | `info`                           | `debug`, `info`, `warn` or `error`.                               |
| `MOCK_AI_DELAY_MS`    | `0`                              | Simulated latency in demo mode.                                   |
