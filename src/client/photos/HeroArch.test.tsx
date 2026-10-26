import { act, fireEvent, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { markLoaded } from '../lib/after-load';
import { renderAt } from '../test/helpers';
import { HeroArch, SLIDE_MS } from './HeroArch';

/** A browser that welcomes motion (or, with `reduce`, asks for less). */
function motion({ reduce = false } = {}) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: reduce && query.includes('reduce'), media: query })),
  );
}

function slides(container: HTMLElement) {
  return [...container.querySelectorAll('.hero-slide')].map((slide) => ({
    current: slide.classList.contains('is-current'),
    previous: slide.classList.contains('is-previous'),
    src: slide.querySelector('img')?.getAttribute('src') ?? '',
  }));
}

afterEach(() => {
  vi.useRealTimers();
});

// The page's "loaded" state is shared by the tests in this file, so they run in this order.
describe('HeroArch', () => {
  it('starts as one labelled picture: the wedding photo, fetched first, without controls', async () => {
    motion();
    const { container } = renderAt(<HeroArch />);
    expect(
      screen.getByRole('img', { name: /plans weddings, Durga Puja, Ganpati/ }),
    ).toBeInTheDocument();
    const [first, ...rest] = slides(container);
    expect(rest).toHaveLength(0);
    expect(first?.src).toMatch(/wedding-\d+\.webp$/);
    expect(container.querySelector('.hero-slide img')).toHaveAttribute('fetchpriority', 'high');
    expect(container.querySelector('.hero-medallion')).toHaveAttribute('alt', '');
    expect(screen.queryByRole('button')).toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('stays on one still photo for people who ask for less movement', () => {
    motion({ reduce: true });
    act(() => {
      markLoaded();
    });
    const { container } = renderAt(<HeroArch />);
    expect(slides(container)).toHaveLength(1);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('turns through the occasions once the page has loaded, and can be paused', async () => {
    vi.useFakeTimers();
    motion();
    const { container } = renderAt(<HeroArch />);
    expect(slides(container)).toHaveLength(5);
    expect(slides(container).map((slide) => slide.current)).toEqual([
      true,
      false,
      false,
      false,
      false,
    ]);

    act(() => {
      vi.advanceTimersByTime(SLIDE_MS);
    });
    const after = slides(container);
    expect(after[1]).toMatchObject({ current: true });
    expect(after[1]?.src).toMatch(/durga-\d+\.webp$/);
    expect(after[0]).toMatchObject({ previous: true });
    expect(container.querySelector('.hero-caption .is-current b')).toHaveTextContent(
      'Shubho Sharodiya',
    );

    const pause = screen.getByRole('button', { name: 'Pause the photographs' });
    expect(pause).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(pause);
    expect(pause).toHaveAttribute('aria-pressed', 'true');
    act(() => {
      vi.advanceTimersByTime(SLIDE_MS * 3);
    });
    expect(slides(container)[1]).toMatchObject({ current: true });

    fireEvent.click(pause);
    act(() => {
      vi.advanceTimersByTime(SLIDE_MS * 4);
    });
    // Back round to the first photo, with the last one beneath it.
    expect(slides(container)[0]).toMatchObject({ current: true });
    expect(slides(container)[4]).toMatchObject({ previous: true });
    vi.useRealTimers();
    expect(await axe(container)).toHaveNoViolations();
  });
});
