/** Composition root: builds the app from environment configuration. */
import type { Hono } from 'hono';
import { AiGateway } from './ai/gateway';
import { GeminiProvider } from './ai/gemini-provider';
import { MockProvider } from './ai/mock-provider';
import { createApp } from './app';
import { loadConfig, type AppConfig } from './config';
import { createLogger, type Logger } from './logger';
import { firebaseTokenVerifier } from './middleware/auth';
import type { AppEnv } from './types';

export interface ServerApp {
  app: Hono<AppEnv>;
  config: AppConfig;
  logger: Logger;
}

export function buildServerApp(env: Record<string, string | undefined> = process.env): ServerApp {
  const config = loadConfig(env);
  const logger = createLogger(config.logLevel);
  const provider =
    config.ai.provider === 'gemini' && config.ai.apiKey
      ? new GeminiProvider(config.ai.apiKey)
      : new MockProvider(config.ai.mockDelayMs);
  const gateway = new AiGateway({
    provider,
    models: config.ai.models,
    maxRequestsPerMinute: config.ai.maxRequestsPerMinute,
    logger,
  });
  const verifier = config.firebase ? firebaseTokenVerifier(config.firebase.projectId) : null;
  logger.info('server.configured', {
    ai: provider.name,
    smartModel: config.ai.models.smart,
    fastModel: config.ai.models.fast,
    firebase: config.firebase !== null,
    authForAi: config.requireAuthForAi,
  });
  return { app: createApp({ config, logger, gateway, verifier }), config, logger };
}
