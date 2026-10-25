import { describe, expect, it } from 'vitest';
import { writtenIn } from './written-in';

describe('writtenIn', () => {
  it('marks Urdu and Arabic text as right-to-left', () => {
    expect(writtenIn('ur')).toEqual({ lang: 'ur', dir: 'rtl' });
    expect(writtenIn('ar')).toEqual({ lang: 'ar', dir: 'rtl' });
  });

  it('gives other languages only their lang', () => {
    expect(writtenIn('bn')).toEqual({ lang: 'bn' });
    expect(writtenIn('en')).toEqual({ lang: 'en' });
  });
});
