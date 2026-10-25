/**
 * AI routes. Every body is validated with the shared schemas; model answers are validated and
 * sanitised again before they are returned. Personalisation streams NDJSON: one line per plan
 * section as soon as it is ready, so the UI fills in progressively.
 */
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { stream } from 'hono/streaming';
import {
  BriefRequest,
  CopilotRequest,
  InvitationRequest,
  PersonalizeRequest,
  RefineRequest,
  type PersonalizeEvent,
} from '../../shared/schemas/ai';
import type { AiGateway } from '../ai/gateway';
import { AiError } from '../ai/provider';
import { extractBrief } from '../ai/tasks/brief';
import { runCopilot } from '../ai/tasks/copilot';
import { draftInvitation } from '../ai/tasks/invitation';
import { generateSection } from '../ai/tasks/sections';
import { AppError } from '../errors';
import { readJson } from '../http';
import type { Logger } from '../logger';
import type { AppEnv } from '../types';

/** User-facing message for a failed AI call (never the upstream error text). */
function aiFailureMessage(error: AiError): string {
  switch (error.kind) {
    case 'blocked':
      return 'Gemini could not answer that request. Try rephrasing it.';
    case 'timeout':
      return 'The AI took too long to answer. Your plan still works; try again in a moment.';
    case 'rate_limited':
      return 'The AI is busy right now. Your plan still works; try again in a minute.';
    case 'unavailable':
    case 'invalid_output':
    case 'bad_request':
    case 'auth':
    case 'aborted':
      return 'The AI is unavailable right now. Your plan still works; try again shortly.';
  }
}

function toHttpError(error: unknown): unknown {
  if (!(error instanceof AiError)) return error;
  if (error.kind === 'blocked') return new AppError(422, 'ai_blocked', aiFailureMessage(error));
  return new AppError(503, 'ai_unavailable', aiFailureMessage(error), 30);
}

/** Runs one AI task, turning its failure into an HTTP error with a friendly message. */
async function aiCall<T>(task: () => Promise<T>): Promise<T> {
  try {
    return await task();
  } catch (error) {
    throw toHttpError(error);
  }
}

/** Cost in rate-limit tokens for each AI route. */
export const AI_ROUTE_COST: Readonly<Record<string, number>> = {
  brief: 1,
  personalize: 4,
  refine: 2,
  copilot: 2,
  invitation: 1,
};

export function aiRoutes(gateway: AiGateway, logger: Logger): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.use(
    '*',
    bodyLimit({
      maxSize: 32 * 1024,
      onError: () => {
        throw new AppError(413, 'payload_too_large', 'The request is too large');
      },
    }),
  );

  app.post('/brief', async (c) => {
    const request = await readJson(c, BriefRequest);
    const { response, meta } = await aiCall(() => extractBrief(gateway, request, c.req.raw.signal));
    return c.json({ ...response, meta });
  });

  app.post('/personalize', async (c) => {
    const request = await readJson(c, PersonalizeRequest);
    const requestId = c.get('requestId');
    c.header('Content-Type', 'application/x-ndjson; charset=utf-8');
    c.header('X-Accel-Buffering', 'no');
    return stream(c, async (output) => {
      const controller = new AbortController();
      output.onAbort(() => {
        controller.abort();
      });
      const started = performance.now();
      let queue = Promise.resolve();
      const send = (event: PersonalizeEvent) => {
        queue = queue.then(() => output.write(`${JSON.stringify(event)}\n`)).then(() => undefined);
        return queue;
      };
      await Promise.all(
        [...new Set(request.sections)].map(async (section) => {
          try {
            const { result, meta } = await generateSection(gateway, {
              section,
              brief: request.brief,
              today: request.today,
              signal: controller.signal,
            });
            await send({ type: 'section', ...result, meta });
          } catch (error) {
            const aiError =
              error instanceof AiError ? error : new AiError('unavailable', 'Unexpected failure');
            logger.warn('ai.section_failed', { requestId, section, kind: aiError.kind });
            await send({
              type: 'section_error',
              section,
              code: aiError.kind,
              message: aiFailureMessage(aiError),
            });
          }
        }),
      );
      await send({ type: 'done', ms: Math.round(performance.now() - started) });
    });
  });

  app.post('/refine', async (c) => {
    const request = await readJson(c, RefineRequest);
    const { result, meta } = await aiCall(() =>
      generateSection(gateway, {
        section: request.section,
        brief: request.brief,
        today: request.today,
        instruction: request.instruction,
        existing: request.existing,
        signal: c.req.raw.signal,
      }),
    );
    return c.json({ ...result, meta });
  });

  app.post('/copilot', async (c) => {
    const request = await readJson(c, CopilotRequest);
    const { response, meta } = await aiCall(() => runCopilot(gateway, request, c.req.raw.signal));
    return c.json({ ...response, meta });
  });

  app.post('/invitation', async (c) => {
    const request = await readJson(c, InvitationRequest);
    const { variants, meta } = await aiCall(() =>
      draftInvitation(gateway, request, c.req.raw.signal),
    );
    return c.json({ variants, meta });
  });

  return app;
}
