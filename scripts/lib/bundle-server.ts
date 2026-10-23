import { build, type BuildResult } from 'esbuild';

export interface BundleOptions {
  /** TypeScript entry point, e.g. `src/server/node.ts`. */
  entry: string;
  /** Output file (ESM), e.g. `dist/server/node.mjs`. */
  outfile: string;
  /** Emit a source map next to the bundle (useful for readable stack traces). */
  sourcemap?: boolean;
}

/**
 * Bundles a server entry and all of its dependencies into a single ESM file.
 * A self-contained bundle starts faster (one file to load) and needs no node_modules at runtime,
 * which keeps the container image and the Vercel function small.
 */
export async function bundleServer({
  entry,
  outfile,
  sourcemap = true,
}: BundleOptions): Promise<BuildResult> {
  return build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    sourcemap,
    minifySyntax: true,
    legalComments: 'none',
    logLevel: 'warning',
    // Some CommonJS dependencies call `require` at runtime; provide it inside the ESM bundle.
    banner: {
      js: "import { createRequire as __mehfilCreateRequire } from 'node:module'; const require = __mehfilCreateRequire(import.meta.url);",
    },
    // Optional native accelerators of the `ws` package; the pure-JS fallback is used instead.
    external: ['bufferutil', 'utf-8-validate'],
  });
}
