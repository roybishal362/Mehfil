/**
 * Puts the prerendered home page into dist/client/index.html. Runs after the client build and
 * the SSR build of src/client/prerender.tsx (see the build:web script).
 */
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const INDEX = 'dist/client/index.html';
const SSR_BUNDLE = 'dist/prerender/prerender.js';
const MOUNT = '<div id="root"></div>';

const { renderPage } = (await import(pathToFileURL(SSR_BUNDLE).href)) as {
  renderPage: (path: string) => string;
};
const html = readFileSync(INDEX, 'utf8');
if (!html.includes(MOUNT)) throw new Error(`${INDEX} has no empty ${MOUNT} to fill`);
writeFileSync(INDEX, html.replace(MOUNT, `<div id="root">${renderPage('/')}</div>`));
rmSync('dist/prerender', { recursive: true, force: true });
process.stdout.write('Prerendered the home page into dist/client/index.html\n');
