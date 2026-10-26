import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { archPhoto } from '.';
import { Arch } from './Arch';
import { Photo } from './Photo';

describe('Photo', () => {
  it('is decorative, sized against layout shift, and lazy by default', () => {
    const { container } = render(<Photo photo={archPhoto('durga')} sizes="200px" />);
    const image = container.querySelector('img');
    expect(image).toHaveAttribute('alt', '');
    expect(image).toHaveAttribute('width', '720');
    expect(image).toHaveAttribute('height', '900');
    expect(image).toHaveAttribute('sizes', '200px');
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image?.getAttribute('srcset')).toMatch(/durga-240\.webp 240w, .*durga-480\.webp 480w/);
  });

  it('is fetched first when it is on the first screen', () => {
    const { container } = render(<Photo photo={archPhoto('wedding')} sizes="430px" priority />);
    const image = container.querySelector('img');
    expect(image).toHaveAttribute('loading', 'eager');
    expect(image).toHaveAttribute('fetchpriority', 'high');
  });
});

describe('Arch', () => {
  it('frames its photo in a window with a decorative outline', async () => {
    const { container } = render(
      <Arch className="x">
        <Photo photo={archPhoto('diwali')} sizes="200px" />
      </Arch>,
    );
    expect(container.querySelector('.arch.x > .arch-window > img')).not.toBeNull();
    expect(container.querySelector('svg.arch-line')).toHaveAttribute('aria-hidden', 'true');
    expect(await axe(container)).toHaveNoViolations();
  });
});
