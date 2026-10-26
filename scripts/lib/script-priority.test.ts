import { describe, expect, it } from 'vitest';
import { lowerScriptPriority } from './script-priority';

describe('lowerScriptPriority', () => {
  it('fetches module scripts and their preloads at low priority, once', () => {
    const html = [
      '<script src="/theme-init.js"></script>',
      '<script type="module" crossorigin src="/assets/index.js"></script>',
      '<link rel="modulepreload" crossorigin href="/assets/plans.js">',
      '<link rel="preload" href="/assets/font.woff2" as="font">',
    ].join('\n');
    const once = lowerScriptPriority(html);
    expect(once).toContain(
      '<script type="module" fetchpriority="low" crossorigin src="/assets/index.js">',
    );
    expect(once).toContain(
      '<link rel="modulepreload" fetchpriority="low" crossorigin href="/assets/plans.js">',
    );
    // The theme script and the font preload keep their priority.
    expect(once).toContain('<script src="/theme-init.js"></script>');
    expect(once).toContain('<link rel="preload" href="/assets/font.woff2" as="font">');
    expect(lowerScriptPriority(once)).toBe(once);
  });
});
