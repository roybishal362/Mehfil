/**
 * Prints what Gemini wrote for one celebration, to inspect language and tone by eye:
 * `npx tsx evals/peek.ts bn` (reads GEMINI_API_KEY from .env.local).
 */
import { existsSync } from 'node:fs';
import { buildServerApp } from '../src/server/bootstrap';
import { PersonalizeEvent } from '../src/shared/schemas/ai';
import { EventBrief } from '../src/shared/schemas/brief';
import { OutputLanguage } from '../src/shared/schemas/primitives';
import { addDays, localToday } from '../src/shared/utils/dates';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');
const language = OutputLanguage.parse(process.argv[2] ?? 'bn');
const { app } = buildServerApp({
  ...process.env,
  REQUIRE_AUTH_FOR_AI: 'false',
  AI_RATE_LIMIT: '1000',
  LOG_LEVEL: 'error',
});
const today = localToday();
const brief = EventBrief.parse({
  type: 'wedding',
  title: 'Ananya and Rohan',
  date: addDays(today, 120),
  city: 'Kolkata',
  guestCount: 300,
  budget: 1_800_000,
  currency: 'INR',
  dietary: ['vegetarian'],
  language,
});
const response = await app.request('/api/ai/personalize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ brief, today, sections: ['ideas', 'timeline'] }),
});
for (const line of (await response.text()).split('\n').filter(Boolean)) {
  const event = PersonalizeEvent.safeParse(JSON.parse(line));
  if (!event.success || event.data.type !== 'section') continue;
  const data = event.data.data as Record<string, unknown>;
  console.log(`--- ${event.data.section} (${event.data.meta.model})`);
  console.log(JSON.stringify(data, null, 1).slice(0, 1800));
}
