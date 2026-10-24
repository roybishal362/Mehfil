/**
 * Checks real Gemini answers against sample celebrations: `npm run eval` (reads GEMINI_API_KEY
 * from .env.local). For each sample it reads the description, tailors all four plan sections,
 * merges them with the app's own engine, and checks what matters: valid structured answers from
 * Gemini (not the fallback), budgets that add up, dates before the event, food that respects the
 * diet, no invented contact details, and text in the requested language. Writes
 * evals/report.md. `npm run eval -- --mock` runs the same checks against demo mode.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createBaselinePlan } from '../src/shared/domain/baseline';
import { mergeSection } from '../src/shared/domain/merge';
import { BriefApiResponse, PersonalizeEvent } from '../src/shared/schemas/ai';
import { EventBrief } from '../src/shared/schemas/brief';
import type { EventPlan } from '../src/shared/schemas/plan';
import type { OutputLanguage } from '../src/shared/schemas/primitives';
import { localToday } from '../src/shared/utils/dates';
import { createId } from '../src/shared/utils/ids';
import { buildServerApp } from '../src/server/bootstrap';

interface Sample {
  name: string;
  text: string;
  language: OutputLanguage;
  diet?: 'vegetarian' | 'jain';
}

const SAMPLES: readonly Sample[] = [
  {
    name: 'Bengali wedding, written in Bengali',
    text: 'A Bengali wedding of Ananya and Rohan in Kolkata on 14 Feb 2027 for about 300 guests. Budget ₹18 lakh, mostly vegetarian, and the grandparents need wheelchair access.',
    language: 'bn',
  },
  {
    name: 'Birthday described in Hindi',
    text: 'दिल्ली में 12 दिसंबर 2026 को आरव का सातवाँ जन्मदिन, 40 मेहमान, बजट 60,000 रुपये, डायनासोर थीम।',
    language: 'hi',
  },
  {
    name: 'Durga Puja community feast',
    text: 'Durga Puja community feast in Kolkata on 17 Oct 2027 for 800 people, budget ₹6 lakh, pure veg bhog.',
    language: 'en',
    diet: 'vegetarian',
  },
  {
    name: 'Jain anniversary dinner',
    text: "Our parents' 25th wedding anniversary dinner in Ahmedabad on 6 Mar 2027 for 120 guests, budget ₹4 lakh, Jain food only.",
    language: 'en',
    diet: 'jain',
  },
  {
    name: 'Short-notice birthday',
    text: 'A surprise 30th birthday on a Bengaluru rooftop two weeks from today for 25 friends, budget 40k.',
    language: 'en',
  },
  {
    name: 'Eid community lunch',
    text: 'Eid community lunch in Hyderabad on 11 Mar 2027 for 200 people, budget ₹3 lakh, halal food.',
    language: 'en',
  },
];

const mock = process.argv.includes('--mock');
if (!mock && existsSync('.env.local')) process.loadEnvFile('.env.local');
if (!mock && !process.env.GEMINI_API_KEY) {
  console.error('Put GEMINI_API_KEY in .env.local, or run `npm run eval -- --mock`.');
  process.exit(1);
}
const { app } = buildServerApp({
  ...process.env,
  AI_PROVIDER: mock ? 'mock' : 'gemini',
  // The evaluation calls the API directly, without the browser's Firebase session.
  REQUIRE_AUTH_FOR_AI: 'false',
  AI_RATE_LIMIT: '1000',
  // Demo mode has no quota; with Gemini the free tier's per-minute limit applies (see below).
  ...(mock ? { AI_MAX_RPM: '1000' } : {}),
  LOG_LEVEL: 'warn',
});
/** Each sample makes four calls to the fast model; spacing them keeps under the free tier. */
const PAUSE_MS = mock ? 0 : 25_000;
const expectedMode = mock ? 'mock' : 'gemini';
const today = localToday();

const NON_VEG =
  /\b(chicken|mutton|lamb|goat|fish|prawns?|shrimp|crab|eggs?|meat|beef|pork|keema|biryani with meat)\b|মাছ|মাংস|ডিম|मछली|मांस|अंडा|चिकन/iu;
const JAIN_AVOID = /\b(onions?|garlic|potato(es)?|carrots?)\b|পেঁয়াজ|রসুন|आलू|प्याज|लहसुन/iu;
/** Ten or more digits in a row (a phone number, not a date), an email address or a link. */
const CONTACT = /(?:\d[\s-]?){10,}|[\w.+-]+@[\w-]+\.[\w.]+|https?:\/\/|www\./iu;
const SCRIPT: Partial<Record<OutputLanguage, RegExp>> = {
  hi: /[ऀ-ॿ]/u,
  bn: /[ঀ-৿]/u,
};

async function post(path: string, body: unknown): Promise<Response> {
  return app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

interface Result {
  sample: string;
  checks: Record<string, boolean | string>;
  models: string[];
  seconds: number;
}

/** Fills what the description did not say, as the step-by-step form would ask for. */
function completeBrief(partial: Record<string, unknown>, sample: Sample) {
  const type = typeof partial.type === 'string' ? partial.type : 'other';
  const city = typeof partial.city === 'string' ? partial.city : 'Kolkata';
  return EventBrief.safeParse({
    title: `${type} in ${city}`,
    ...partial,
    language: sample.language,
  });
}

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

async function evaluate(sample: Sample): Promise<Result> {
  const started = Date.now();
  const checks: Record<string, boolean | string> = {};
  const models = new Set<string>();

  const briefResponse = BriefApiResponse.safeParse(
    await (await post('/api/ai/brief', { text: sample.text, today, uiLanguage: 'en' })).json(),
  );
  if (!briefResponse.success) {
    return { sample: sample.name, checks: { brief: 'invalid answer' }, models: [], seconds: 0 };
  }
  models.add(briefResponse.data.meta.model);
  checks['brief from Gemini'] = briefResponse.data.meta.mode === expectedMode;
  const brief = completeBrief(briefResponse.data.brief, sample);
  checks['brief complete'] = brief.success || 'missing fields';
  if (!brief.success) return { sample: sample.name, checks, models: [...models], seconds: 0 };

  const stream = await (await post('/api/ai/personalize', { brief: brief.data, today })).text();
  const context = { today, now: new Date().toISOString(), makeId: createId };
  let plan: EventPlan = createBaselinePlan(brief.data, context);
  let tailored = 0;
  for (const line of stream.split('\n').filter(Boolean)) {
    const event = PersonalizeEvent.safeParse(JSON.parse(line));
    if (!event.success || event.data.type !== 'section') continue;
    models.add(event.data.meta.model);
    if (event.data.meta.mode === expectedMode) tailored += 1;
    plan = mergeSection(plan, { section: event.data.section, data: event.data.data } as never, {
      ...context,
      model: event.data.meta.model,
    });
  }
  checks['4 sections from Gemini'] = tailored === 4 || `${String(tailored)} of 4`;

  const lines = plan.budget.lines.reduce((sum, line) => sum + line.planned, 0);
  checks['budget adds up'] = lines === plan.budget.total;
  const lastDay = brief.data.endDate ?? brief.data.date;
  checks['dates in range'] = plan.tasks.every(
    (task) => task.dueDate >= today && (task.daysBefore < 0 || task.dueDate <= lastDay),
  );
  const text = strings({ ideas: plan.ideas, schedule: plan.schedule, summary: plan.summary });
  checks['no contact details'] = !strings(plan).some((value) => CONTACT.test(value));
  if (sample.diet) {
    const food = plan.ideas.filter((idea) => idea.kind === 'food').flatMap(strings);
    checks['respects the diet'] =
      !food.some((value) => NON_VEG.test(value)) &&
      (sample.diet !== 'jain' || !food.some((value) => JAIN_AVOID.test(value)));
  }
  // The demo provider always answers in English, so only Gemini's language is checked.
  const script = mock ? undefined : SCRIPT[sample.language];
  if (script) {
    const written = text.filter((value) => value.length > 12);
    const inScript = written.filter((value) => script.test(value)).length;
    checks[`written in ${sample.language}`] = inScript >= written.length * 0.8;
  }
  checks['has a summary'] = Boolean(plan.summary);
  return {
    sample: sample.name,
    checks,
    models: [...models],
    seconds: Math.round((Date.now() - started) / 100) / 10,
  };
}

const results: Result[] = [];
for (const [index, sample] of SAMPLES.entries()) {
  if (index > 0 && PAUSE_MS > 0) await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
  process.stdout.write(`${sample.name}… `);
  const result = await evaluate(sample);
  results.push(result);
  const failed = Object.entries(result.checks).filter(([, ok]) => ok !== true);
  process.stdout.write(failed.length === 0 ? 'ok\n' : `${String(failed.length)} failed\n`);
}

const mark = (ok: boolean | string | undefined) =>
  ok === undefined ? '—' : ok === true ? '✅' : `❌ ${ok === false ? '' : ok}`.trim();
const columns = [...new Set(results.flatMap((result) => Object.keys(result.checks)))];
const report = [
  `# Gemini evaluation (${mock ? 'demo mode' : 'Gemini'}), ${new Date().toISOString().slice(0, 10)}`,
  '',
  `| Sample | ${columns.join(' | ')} | Models | Seconds |`,
  `| --- | ${columns.map(() => '---').join(' | ')} | --- | --- |`,
  ...results.map(
    (result) =>
      `| ${result.sample} | ${columns.map((column) => mark(result.checks[column])).join(' | ')} | ${result.models.join(', ')} | ${String(result.seconds)} |`,
  ),
  '',
].join('\n');
mkdirSync('evals', { recursive: true });
writeFileSync('evals/report.md', report);
const failures = results.flatMap((result) =>
  Object.values(result.checks).filter((ok) => ok !== true),
);
console.log(`\n${String(failures.length)} failed checks. Report: evals/report.md`);
process.exitCode = failures.length > 0 ? 1 : 0;
