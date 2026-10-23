/**
 * Builds the Node entry (`npm start`, Docker, E2E tests) into `dist/server/node.mjs`, and writes
 * Brotli and gzip copies of the client build so the server can send them precompressed.
 */
import { existsSync } from 'node:fs';
import { bundleServer } from './lib/bundle-server';
import { compressDirectory } from './lib/compress';

await bundleServer({ entry: 'src/server/node.ts', outfile: 'dist/server/node.mjs' });
process.stdout.write('Built dist/server/node.mjs\n');

if (existsSync('dist/client')) {
  const { files, bytesIn, bytesBrotli } = compressDirectory('dist/client');
  const kb = (bytes: number) => `${(bytes / 1024).toFixed(0)} KB`;
  process.stdout.write(
    `Precompressed ${String(files)} files: ${kb(bytesIn)} -> ${kb(bytesBrotli)} (brotli)\n`,
  );
}
