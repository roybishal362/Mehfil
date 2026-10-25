import { act, fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ART_NAMES, artUrl } from '.';
import { markLoaded } from '../lib/after-load';
import { Art } from './Art';

describe('artUrl', () => {
  it('has a large and a small file for every artwork', () => {
    for (const name of ART_NAMES) {
      expect(artUrl(name, 256), name).toMatch(new RegExp(`${name}(?:-[\\w-]+)?\\.webp`));
      expect(artUrl(name, 32), name).toMatch(new RegExp(`${name}-sm(?:-[\\w-]+)?\\.webp`));
    }
  });

  it('uses the small file for icons up to 48 pixels', () => {
    expect(artUrl('diya', 48)).toBe(artUrl('diya', 20));
    expect(artUrl('diya', 49)).toBe(artUrl('diya', 256));
    expect(artUrl('diya', 48)).not.toBe(artUrl('diya', 49));
  });
});

describe('Art', () => {
  // Module state is fresh in each test file, so the page has not "loaded" yet here.
  it('can wait for the page to load, holding its place, then fades in', () => {
    const { container } = render(<Art name="ring" size={120} className="x" afterLoad />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('span.art.art--waiting.x')).not.toBeNull();
    act(() => {
      markLoaded();
    });
    const image = container.querySelector('img');
    expect(image).toHaveClass('art', 'art--arriving', 'x');
    expect(image).not.toHaveAttribute('loading');
    if (!image) throw new Error('no image');
    fireEvent.load(image);
    expect(image).toHaveClass('art--arrived');
  });

  it('is decorative, sized, and otherwise loads lazily', () => {
    const { container } = render(<Art name="lotus" size={64} />);
    const image = container.querySelector('img');
    expect(image).toHaveAttribute('alt', '');
    expect(image).toHaveAttribute('width', '64');
    expect(image).toHaveAttribute('height', '64');
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image?.getAttribute('src')).toMatch(/lotus\.webp$/);
  });
});
