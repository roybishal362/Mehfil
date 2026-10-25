/** Invitation drafts in the chosen tone, channel and language, cleaned before they leave. */
import {
  InvitationDraft,
  type AiMetaInfo,
  type InvitationRequest,
} from '../../../shared/schemas/ai';
import { cleanModelText, cleanMultilineText } from '../../../shared/utils/text';
import type { AiGateway } from '../gateway';
import { invitationPrompt, systemPrompt } from '../prompts';
import { aiMeta } from './meta';

export async function draftInvitation(
  gateway: AiGateway,
  request: InvitationRequest,
  signal?: AbortSignal,
): Promise<{ variants: InvitationDraft['variants']; meta: AiMetaInfo }> {
  const outcome = await gateway.json(
    {
      task: 'invitation',
      model: gateway.models.fast,
      system: systemPrompt(request.language),
      prompt: invitationPrompt(request),
      schema: InvitationDraft,
      temperature: 0.8,
      maxOutputTokens: 2048,
      thinking: 'minimal',
      timeoutMs: 15_000,
      input: request,
      ...(signal ? { signal } : {}),
    },
    20_000,
  );
  const variants = outcome.data.variants
    .map((v) => ({ label: cleanModelText(v.label, 40), text: cleanMultilineText(v.text, 1200) }))
    .filter((v) => v.label && v.text);
  return { variants, meta: aiMeta(outcome, gateway.mode) };
}
