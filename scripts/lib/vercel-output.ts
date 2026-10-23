/**
 * Routing and function settings for the Vercel deployment (Build Output API v3). They are
 * generated from the same header and cache policy the Node server applies, so a Vercel
 * deployment, `npm start` and the Docker image all send identical headers.
 */
import { CACHE_RULES, securityHeaders } from '../../src/server/security/headers';

/** The single function that runs the Hono API (served at /api/*). */
export const FUNCTION_NAME = 'api';

export type VercelRoute =
  | {
      src: string;
      dest?: string;
      headers?: Record<string, string>;
      continue?: boolean;
      status?: number;
    }
  | { handle: 'filesystem' };

export interface VercelConfig {
  version: 3;
  routes: VercelRoute[];
}

export function vercelConfig(): VercelConfig {
  return {
    version: 3,
    routes: [
      // Pages and files get the security headers here; the API function sets the same ones itself.
      {
        src: '^/(?!api(?:/|$)).*$',
        headers: securityHeaders({ production: true }),
        continue: true,
      },
      // Hashed build assets never change.
      { src: '^/assets/.+$', headers: { 'Cache-Control': CACHE_RULES.immutable }, continue: true },
      // The function receives the original URL, so the app routes /api/health etc. itself.
      { src: '^/api(?:/.*)?$', dest: `/${FUNCTION_NAME}` },
      // Static files first; the routes below only run when no file matched.
      { handle: 'filesystem' },
      // A missing build asset is a real 404, never the HTML shell.
      { src: '^/assets/.+$', status: 404 },
      // Every other path is an app route: serve the HTML shell and let the client router take over.
      { src: '^/.*$', dest: '/index.html' },
    ],
  };
}

export interface FunctionConfig {
  runtime: string;
  handler: string;
  launcherType: 'Nodejs';
  shouldAddHelpers: boolean;
  shouldAddSourcemapSupport: boolean;
  supportsResponseStreaming: boolean;
  maxDuration: number;
  regions: string[];
}

export function functionConfig(): FunctionConfig {
  return {
    runtime: 'nodejs24.x',
    handler: 'index.mjs',
    launcherType: 'Nodejs',
    // Hono reads the raw request itself; Vercel's body-parsing helpers would get in the way.
    shouldAddHelpers: false,
    shouldAddSourcemapSupport: true,
    // Lets /api/ai/personalize stream each plan section as soon as it is ready.
    supportsResponseStreaming: true,
    // AI calls have their own 45-second deadline; this is only a backstop.
    maxDuration: 60,
    // Mumbai, close to the app's Indian audience.
    regions: ['bom1'],
  };
}
