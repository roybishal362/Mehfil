import type { AiMetaInfo } from '../../../shared/schemas/ai';
import type { AiGateway, AiOutcome } from '../gateway';

/** What the browser learns about an AI call: which model answered, in which mode, how fast. */
export function aiMeta(outcome: AiOutcome<unknown>, mode: AiGateway['mode']): AiMetaInfo {
  return { model: outcome.model, mode, cached: outcome.cached, ms: outcome.ms };
}
