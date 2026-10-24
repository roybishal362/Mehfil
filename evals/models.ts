/**
 * Times the ideas section, the heaviest Gemini task, on candidate models: `npx tsx
 * evals/models.ts gemini-3.5-flash gemini-3.8-flash …` (reads GEMINI_API_KEY from .env.local).
 * Each model handles two different celebrations; the result says whether Gemini answered (or
 * the plan fell back to the template) and how long it took.
 */
import { existsSync } from 'node:fs';
import { buildServerApp } from '../src/server/bootstrap';
import { PersonalizeEvent } from '../src/shared/schemas/ai';
import { EventBrief, type EventBriefInput } from '../src/shared/schemas/brief';
import { addDays, localToday } from '../src/shared/utils/dates';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');
const models = process.argv.slice(2);
if (models.length === 0 || !process.env.GEMINI_API_KEY) {
  console.error('Usage: npx tsx evals/models.ts <model> [<model> …] (with GEMINI_API_KEY set)');
  process.exit(1);
}

const today = localToday();
const BRIEFS: EventBriefInput[] = [
  {
    type: 'wedding',
    title: 'Ananya and Rohan',
    date: addDays(today, 120),
    city: 'Kolkata',
    guestCount: 300,
    budget: 1_800_000,
    currency: 'INR',
    dietary: ['vegetarian'],
    language: 'bn',
  },
  {
    type: 'birthday',
    title: 'Mira turns 7',
    date: addDays(today, 45),
    city: 'Pune',
    guestCount: 40,
    budget: 60_000,
    currency: 'INR',
    language: 'en',
  },
];

for (const model of models) {
  // Both slots use the model under test, so a fallback never hides a failure.
  const { app } = buildServerApp({
    ...process.env,
    GEMINI_MODEL_SMART: model,
    GEMINI_MODEL_FAST: model,
    REQUIRE_AUTH_FOR_AI: 'false',
    AI_RATE_LIMIT: '1000',
    LOG_LEVEL: 'error',
  });
  const results: string[] = [];
  for (const input of BRIEFS) {
    const started = Date.now();
    const response = await app.request('/api/ai/personalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brief: EventBrief.parse(input), today, sections: ['ideas'] }),
    });
    const events = (await response.text())
      .split('\n')
      .filter(Boolean)
      .map((line) => PersonalizeEvent.safeParse(JSON.parse(line)));
    const section = events.find((event) => event.success && event.data.type === 'section');
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    results.push(
      section?.success && section.data.type === 'section'
        ? `${section.data.meta.mode} in ${seconds}s`
        : `failed after ${seconds}s`,
    );
  }
  console.log(`${model.padEnd(24)} ${results.join(' | ')}`);
}
