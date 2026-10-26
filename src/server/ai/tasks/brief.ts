/**
 * Reading a description: Gemini extracts a structured brief, and each field it returns is
 * validated on its own, so one bad value never throws away the rest.
 */
import {
  BriefExtraction,
  type AiMetaInfo,
  type BriefRequest,
  type BriefResponse,
} from '../../../shared/schemas/ai';
import { PartialBrief } from '../../../shared/schemas/brief';
import type { OutputLanguage } from '../../../shared/schemas/primitives';
import { cleanModelText, cleanText } from '../../../shared/utils/text';
import type { AiGateway } from '../gateway';
import { briefPrompt, systemPrompt } from '../prompts';
import { aiMeta } from './meta';

/** One extracted field, cleaned, if it passes validation on its own; otherwise nothing. */
function validField(key: string, value: unknown): [string, unknown] | [] {
  const cleaned = typeof value === 'string' ? cleanText(value, 300) : value;
  if (cleaned === '') return [];
  const single = PartialBrief.safeParse({ [key]: cleaned });
  return single.success && key in single.data ? [key, cleaned] : [];
}

/** Keeps only the extracted fields that pass validation on their own. */
export function validExtractedFields(
  raw: BriefExtraction['brief'],
  today: string,
): BriefResponse['brief'] {
  const fields = Object.entries(raw).flatMap(([key, value]) => {
    const field = validField(key, value);
    return field.length ? [field] : [];
  });
  const brief = PartialBrief.parse(Object.fromEntries(fields));
  // A past date, or an end before the start, is a misreading: better to ask again.
  if (brief.date && brief.date < today) delete brief.date;
  if (brief.endDate && (!brief.date || brief.endDate < brief.date)) delete brief.endDate;
  return brief;
}

export async function extractBrief(
  gateway: AiGateway,
  request: BriefRequest,
  signal?: AbortSignal,
): Promise<{ response: BriefResponse; meta: AiMetaInfo }> {
  const language: OutputLanguage = request.uiLanguage;
  const outcome = await gateway.json(
    {
      task: 'brief',
      model: gateway.models.fast,
      system: systemPrompt(language),
      prompt: briefPrompt(request.text, request.today),
      schema: BriefExtraction,
      temperature: 0.1,
      maxOutputTokens: 1024,
      thinking: 'minimal',
      timeoutMs: 12_000,
      input: request,
      ...(signal ? { signal } : {}),
    },
    15_000,
  );
  const brief = validExtractedFields(outcome.data.brief, request.today);
  const missing = (['type', 'date', 'city', 'guestCount', 'budget'] as const).filter(
    (field) => brief[field] === undefined,
  );
  const question = outcome.data.question ? cleanModelText(outcome.data.question, 200) : '';
  return {
    response: { brief, missing, ...(question && missing.length ? { question } : {}) },
    meta: aiMeta(outcome, gateway.mode),
  };
}
