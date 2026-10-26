import { act, fireEvent, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderAt } from '../../test/helpers';
import { Celebration } from './Celebration';
import { MOMENT_DURATION, type MomentMood } from './celebrated';
import { Moment, PHOTO_WAIT_MS } from './Moment';
import css from './moments.css?raw';

const MOODS = Object.keys(MOMENT_DURATION) as MomentMood[];

function welcomeMotion() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: false, media: query })),
  );
}

beforeEach(() => {
  // jsdom cannot draw on a canvas; the rockets and confetti then simply do not run.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

describe('Moment', () => {
  it.each(MOODS)('plays the %s scene, hidden from assistive technology', async (mood) => {
    const { container } = renderAt(<Moment mood={mood} cheer="Shubh Deepavali" onDone={vi.fn()} />);
    expect(container.querySelector('.moment-stage')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('ends by itself when its scene is over', () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    renderAt(<Moment mood="wedding" cheer="Shubh Vivah" onDone={onDone} />);
    act(() => {
      vi.advanceTimersByTime(MOMENT_DURATION.wedding - 1);
    });
    expect(onDone).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('ends at once on Skip or any key, returning focus to the plan’s heading', () => {
    const onDone = vi.fn();
    renderAt(
      <>
        <h1 id="plan-title" tabIndex={-1}>
          Ananya &amp; Rohan
        </h1>
        <Moment mood="durga" cheer="Shubho Sharodiya" onDone={onDone} />
      </>,
    );
    const skip = screen.getByRole('button', { name: 'Skip' });
    skip.focus();
    fireEvent.click(skip);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Shift' });
    expect(onDone).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(onDone).toHaveBeenCalledTimes(3);
  });

  it.each(MOODS)('opens onto the %s photograph', (mood) => {
    const { container } = renderAt(<Moment mood={mood} cheer="!" onDone={vi.fn()} />);
    const photo = container.querySelector('.moment-photo img');
    expect(photo).toHaveAttribute('alt', '');
    expect(photo?.getAttribute('src')).toMatch(new RegExp(`${mood}-moment\\.webp$`));
  });

  describe('in a browser that can tell when a photo is ready', () => {
    afterEach(() => {
      Reflect.deleteProperty(HTMLImageElement.prototype, 'decode');
      vi.useRealTimers();
    });

    function decodeWith(result: () => Promise<void>) {
      Object.defineProperty(HTMLImageElement.prototype, 'decode', {
        configurable: true,
        value: vi.fn(result),
      });
    }

    it('plays once its photograph is ready', async () => {
      decodeWith(() => Promise.resolve());
      const { container } = renderAt(<Moment mood="birthday" cheer="!" onDone={vi.fn()} />);
      expect(container.querySelector('.moment')).toBeNull();
      expect(await screen.findByRole('button', { name: 'Skip' })).toBeInTheDocument();
    });

    it('quietly skips when the photograph is slow or fails', async () => {
      vi.useFakeTimers();
      decodeWith(() => new Promise<void>(() => undefined));
      const slow = vi.fn();
      const { container } = renderAt(<Moment mood="diwali" cheer="!" onDone={slow} />);
      act(() => {
        vi.advanceTimersByTime(PHOTO_WAIT_MS);
      });
      expect(slow).toHaveBeenCalledTimes(1);
      expect(container.querySelector('.moment')).toBeNull();

      vi.useRealTimers();
      decodeWith(() => Promise.reject(new Error('broken')));
      const failed = vi.fn();
      renderAt(<Moment mood="ganpati" cheer="!" onDone={failed} />);
      await vi.waitFor(() => {
        expect(failed).toHaveBeenCalledTimes(1);
      });
    });
  });

  it('times each scene in CSS to match its duration in code', () => {
    for (const mood of MOODS) {
      const start = css.indexOf(`.moment--${mood} {`);
      const block = css.slice(start, css.indexOf('}', start));
      const seconds = /--moment-duration:\s*([\d.]+)s/.exec(block)?.[1];
      expect(Number(seconds) * 1000, mood).toBe(MOMENT_DURATION[mood]);
    }
  });
});

describe('Celebration', () => {
  it('offers to celebrate again and plays the moment on request', async () => {
    renderAt(<Celebration planId="evt_replay" mood="diwali" />);
    // Without matchMedia (as here) nothing plays by itself.
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Celebrate again' }));
    expect(await screen.findByRole('button', { name: 'Skip' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
  });

  it('plays by itself the first time a plan opens, and not after that', async () => {
    welcomeMotion();
    const first = renderAt(<Celebration planId="evt_first" mood="wedding" />);
    expect(await screen.findByRole('button', { name: 'Skip' })).toBeInTheDocument();
    first.unmount();
    renderAt(<Celebration planId="evt_first" mood="wedding" />);
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Celebrate again' })).toBeInTheDocument();
  });

  it('has nothing to play for the neutral look', () => {
    welcomeMotion();
    const { container } = renderAt(<Celebration planId="evt_plain" mood="neutral" />);
    expect(container.querySelector('.celebrate-again')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
  });
});
