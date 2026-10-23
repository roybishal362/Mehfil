/**
 * Vercel Function entry (Node.js runtime, Fluid Compute). Bundled by scripts/build-vercel.ts into
 * .vercel/output/functions/api.func. Static files are served by Vercel's CDN, not by this code.
 */
import { getRequestListener } from '@hono/node-server';
import { buildServerApp } from './bootstrap';

const { app } = buildServerApp();

export default getRequestListener(app.fetch);
