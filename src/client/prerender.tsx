/**
 * Build-time prerendering of the home page (see scripts/prerender.ts). The HTML is placed in
 * index.html so the festive first screen paints before any JavaScript runs; main.tsx then
 * hydrates it into the live, interactive page. The tree must match main.tsx exactly.
 */
import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { App } from './App';

export function renderPage(path: string): string {
  return renderToString(
    <StrictMode>
      <App ssrPath={path} />
    </StrictMode>,
  );
}
