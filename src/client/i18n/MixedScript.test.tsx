import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { splitByScript } from './MixedScript';

function html(text: string, locale: 'en' | 'hi' | 'bn') {
  return render(<p>{splitByScript(text, locale)}</p>).container.innerHTML;
}

describe('splitByScript', () => {
  it('marks Hindi and Bengali words in English text with their language', () => {
    expect(html('in English, हिन्दी or বাংলা.', 'en')).toBe(
      '<p>in English, <span lang="hi" class="native">हिन्दी</span> or ' +
        '<span lang="bn" class="native">বাংলা</span>.</p>',
    );
  });

  it('leaves words in the page’s own language alone', () => {
    expect(html('English, हिन्दी या বাংলা में।', 'hi')).toBe(
      '<p>English, हिन्दी या <span lang="bn" class="native">বাংলা</span> में।</p>',
    );
    // The danda is shared by both scripts, so it is never taken for Hindi.
    expect(html('English, हिन्दी বা বাংলায়।', 'bn')).toBe(
      '<p>English, <span lang="hi" class="native">हिन्दी</span> বা বাংলায়।</p>',
    );
  });

  it('keeps a phrase of several words together', () => {
    expect(html('Say शुभ दीपावली to everyone', 'en')).toBe(
      '<p>Say <span lang="hi" class="native">शुभ दीपावली</span> to everyone</p>',
    );
  });

  it('returns text without other scripts unchanged', () => {
    expect(splitByScript('Plain English.', 'en')).toEqual(['Plain English.']);
  });
});
