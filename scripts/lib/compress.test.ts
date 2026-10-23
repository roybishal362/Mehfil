import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { afterAll, describe, expect, it } from 'vitest';
import { compressDirectory } from './compress';

describe('compressDirectory', () => {
  const root = mkdtempSync(join(tmpdir(), 'mehfil-compress-'));
  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('writes brotli and gzip copies of large text files only', () => {
    mkdirSync(join(root, 'assets'));
    const script = 'console.log("diya");\n'.repeat(200);
    writeFileSync(join(root, 'assets', 'index-abc.js'), script);
    writeFileSync(join(root, 'tiny.css'), 'a{}');
    writeFileSync(join(root, 'font.woff2'), Buffer.alloc(4096));

    const result = compressDirectory(root);
    expect(result.files).toBe(1);
    expect(result.bytesBrotli).toBeLessThan(result.bytesIn / 10);
    const js = join(root, 'assets', 'index-abc.js');
    expect(brotliDecompressSync(readFileSync(`${js}.br`)).toString()).toBe(script);
    expect(gunzipSync(readFileSync(`${js}.gz`)).toString()).toBe(script);
    expect(existsSync(join(root, 'tiny.css.br'))).toBe(false);
    expect(existsSync(join(root, 'font.woff2.br'))).toBe(false);
  });
});
