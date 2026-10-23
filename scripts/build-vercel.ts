/**
 * Builds the Vercel deployment with the Build Output API (v3):
 *   .vercel/output/static/             the built client, served by Vercel's CDN
 *   .vercel/output/functions/api.func/  the bundled Hono app (Node.js, streaming responses)
 *   .vercel/output/config.json          routes generated from the shared header and cache policy
 * Runs after `vite build` (see the `build:vercel` npm script).
 */
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { bundleServer } from './lib/bundle-server';
import { FUNCTION_NAME, functionConfig, vercelConfig } from './lib/vercel-output';

const OUTPUT = '.vercel/output';
const CLIENT = 'dist/client';

if (!existsSync(join(CLIENT, 'index.html'))) {
  throw new Error(`${CLIENT}/index.html is missing. Run "npm run build:web" first.`);
}

const writeJson = (path: string, value: unknown) => {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
};

// Only the output folder is replaced; .vercel/project.json from `vercel link` stays.
rmSync(OUTPUT, { recursive: true, force: true });
mkdirSync(OUTPUT, { recursive: true });
cpSync(CLIENT, join(OUTPUT, 'static'), { recursive: true });

const functionDir = join(OUTPUT, 'functions', `${FUNCTION_NAME}.func`);
await bundleServer({ entry: 'src/server/vercel.ts', outfile: join(functionDir, 'index.mjs') });
writeJson(join(functionDir, '.vc-config.json'), functionConfig());
writeJson(join(OUTPUT, 'config.json'), vercelConfig());

process.stdout.write(`Built ${OUTPUT}: static files, the ${FUNCTION_NAME} function and routes\n`);
