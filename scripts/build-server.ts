/**
 * Builds the Node entry (`npm start`, Docker, E2E tests) into `dist/server/node.mjs`.
 */
import { bundleServer } from './lib/bundle-server';

await bundleServer({ entry: 'src/server/node.ts', outfile: 'dist/server/node.mjs' });
process.stdout.write('Built dist/server/node.mjs\n');
