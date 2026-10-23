/**
 * Writes Brotli (.br) and gzip (.gz) copies of compressible build files, so the Node server can
 * send them precompressed (serveStatic `precompressed: true`) without compressing per request.
 * Vercel's CDN compresses on its own, so the Vercel build does not need these.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

const COMPRESSIBLE = new Set([
  '.js',
  '.mjs',
  '.css',
  '.html',
  '.svg',
  '.json',
  '.txt',
  '.ics',
  '.map',
]);
/** Below this size compression does not pay for the extra request headers. */
const MIN_BYTES = 1024;

function* files(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else yield path;
  }
}

export interface CompressResult {
  files: number;
  bytesIn: number;
  bytesBrotli: number;
}

export function compressDirectory(dir: string): CompressResult {
  const result: CompressResult = { files: 0, bytesIn: 0, bytesBrotli: 0 };
  for (const path of files(dir)) {
    if (!COMPRESSIBLE.has(extname(path))) continue;
    const data = readFileSync(path);
    if (data.length < MIN_BYTES) continue;
    const brotli = brotliCompressSync(data, {
      params: {
        [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
        [constants.BROTLI_PARAM_SIZE_HINT]: data.length,
      },
    });
    writeFileSync(`${path}.br`, brotli);
    writeFileSync(`${path}.gz`, gzipSync(data, { level: 9 }));
    result.files += 1;
    result.bytesIn += data.length;
    result.bytesBrotli += brotli.length;
  }
  return result;
}
