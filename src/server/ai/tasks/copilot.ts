/** The Copilot conversation: Gemini answers with function calls that become proposals. */
import type { AiMetaInfo, CopilotRequest, CopilotResponse } from '../../../shared/schemas/ai';
import type { PlanOperation } from '../../../shared/schemas/operations';
import { cleanModelText } from '../../../shared/utils/text';
import type { AiGateway } from '../gateway';
import { copilotSystemPrompt, copilotTurnText } from '../prompts';
import type { ChatTurn } from '../provider';
import { COPILOT_TOOLS, toOperation } from './copilot-tools';
import { aiMeta } from './meta';

/**
 * The conversation as Gemini expects it: starting with the user, then alternating. A failed
 * request leaves two questions in a row, so neighbouring turns from one side are joined.
 */
export function copilotTurns(request: CopilotRequest): ChatTurn[] {
  const turns: ChatTurn[] = [];
  const all: ChatTurn[] = [
    ...request.history.map((turn) => ({
      role: turn.role === 'assistant' ? ('model' as const) : ('user' as const),
      text: turn.text,
    })),
    {
      role: 'user',
      text: copilotTurnText(request.brief, request.today, request.plan, request.message),
    },
  ];
  for (const turn of all) {
    const last = turns.at(-1);
    if (last?.role === turn.role) {
      turns[turns.length - 1] = { role: turn.role, text: `${last.text}\n\n${turn.text}` };
    } else if (last || turn.role === 'user') {
      turns.push(turn);
    }
  }
  return turns;
}

export async function runCopilot(
  gateway: AiGateway,
  request: CopilotRequest,
  signal?: AbortSignal,
): Promise<{ response: CopilotResponse; meta: AiMetaInfo }> {
  const outcome = await gateway.tools(
    {
      task: 'copilot',
      model: gateway.models.smart,
      system: copilotSystemPrompt(request.brief.language),
      contents: copilotTurns(request),
      tools: COPILOT_TOOLS,
      temperature: 0.4,
      maxOutputTokens: 2048,
      thinking: 'low',
      timeoutMs: 25_000,
      input: request,
      ...(signal ? { signal } : {}),
    },
    30_000,
  );
  const operations: PlanOperation[] = [];
  let dropped = 0;
  for (const call of outcome.data.calls.slice(0, 12)) {
    const operation = toOperation(call, request);
    if (operation) operations.push(operation);
    else dropped += 1;
  }
  return {
    response: {
      reply: cleanModelText(outcome.data.text, 800),
      operations: operations.slice(0, 6),
      dropped,
    },
    meta: aiMeta(outcome, gateway.mode),
  };
}
