/**
 * Turning what people type into a brief. Gemini reads the description; the instant local
 * parser fills any gaps and takes over completely when the AI is unreachable, so describing a
 * celebration always gets the user somewhere.
 */
import { quickParse, type QuickParse } from '../../../shared/domain/quick-parse';
import { BriefApiResponse } from '../../../shared/schemas/ai';
import { EventBrief, type EventBriefInput } from '../../../shared/schemas/brief';
import type { Messages } from '../../i18n';
import type { Locale } from '../../i18n/types';
import { postJson } from '../../lib/api';

export type DraftBrief = Partial<EventBriefInput>;

export function draftFromQuickParse(quick: QuickParse): DraftBrief {
  return {
    ...(quick.type ? { type: quick.type } : {}),
    ...(quick.date ? { date: quick.date } : {}),
    ...(quick.city ? { city: quick.city } : {}),
    ...(quick.guestCount ? { guestCount: quick.guestCount } : {}),
    ...(quick.budget ? { budget: quick.budget } : {}),
    ...(quick.currency ? { currency: quick.currency } : {}),
    ...(quick.dietary.length ? { dietary: quick.dietary } : {}),
  };
}

export interface IntakeResult {
  draft: DraftBrief;
  /** True when Gemini could not be used and only the local parser read the text. */
  usedFallback: boolean;
}

export async function readDescription(
  text: string,
  { today, locale, signal }: { today: string; locale: Locale; signal?: AbortSignal },
): Promise<IntakeResult> {
  const local = draftFromQuickParse(quickParse(text, today));
  try {
    const response = await postJson(
      '/api/ai/brief',
      { text, today, uiLanguage: locale },
      BriefApiResponse,
      signal,
    );
    // Gemini's reading wins; the local parser only fills what it left out.
    return { draft: { ...local, ...stripUndefined(response.brief) }, usedFallback: false };
  } catch (error) {
    if (signal?.aborted) throw error;
    return { draft: local, usedFallback: true };
  }
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}

/** Fills the details a description rarely mentions, without inventing any fact. */
export function completeDraft(draft: DraftBrief, t: Messages, locale: Locale): DraftBrief {
  const title =
    draft.title ??
    (draft.type && draft.city ? t.wizard.defaultTitle(t.types[draft.type], draft.city) : undefined);
  return {
    ...draft,
    ...(title ? { title } : {}),
    language: draft.language ?? locale,
  };
}

/** A complete brief, or null when something essential is still missing. */
export function briefFromDraft(draft: DraftBrief): EventBrief | null {
  const result = EventBrief.safeParse(draft);
  return result.success ? result.data : null;
}
