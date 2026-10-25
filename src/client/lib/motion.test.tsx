import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { motionAllowed, useCountUp } from './motion';

function prefersReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: reduce && query.includes('reduce'), media: query })),
  );
}

/** requestAnimationFrame driven by hand: each step() runs one frame at the given time. */
function manualFrames() {
  let callbacks: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callbacks.push(callback);
    return callbacks.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {
    callbacks = [];
  });
  return (time: number) => {
    const due = callbacks;
    callbacks = [];
    act(() => {
      for (const callback of due) callback(time);
    });
  };
}

function Counter({ target }: { target: number }) {
  return <p>{useCountUp(target, 1000)}</p>;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('motionAllowed', () => {
  it('needs matchMedia and no request for reduced motion', () => {
    expect(motionAllowed()).toBe(false);
    prefersReducedMotion(false);
    expect(motionAllowed()).toBe(true);
    prefersReducedMotion(true);
    expect(motionAllowed()).toBe(false);
  });
});

describe('useCountUp', () => {
  it('shows the number straight away without motion', () => {
    render(<Counter target={112} />);
    expect(screen.getByText('112')).toBeInTheDocument();
  });

  it('counts up from zero, easing out, and lands on the target', () => {
    prefersReducedMotion(false);
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const step = manualFrames();
    render(<Counter target={112} />);
    expect(screen.getByText('0')).toBeInTheDocument();
    step(500);
    // Ease-out: past halfway in value at half the time.
    const halfway = Number(screen.getByRole('paragraph').textContent);
    expect(halfway).toBeGreaterThan(56);
    expect(halfway).toBeLessThan(112);
    step(1000);
    expect(screen.getByText('112')).toBeInTheDocument();
  });

  it('counts on from where it was when the target changes', () => {
    prefersReducedMotion(false);
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const step = manualFrames();
    const { rerender } = render(<Counter target={40} />);
    step(1000);
    expect(screen.getByText('40')).toBeInTheDocument();
    rerender(<Counter target={39} />);
    step(0);
    expect(screen.getByText('40')).toBeInTheDocument();
    step(1000);
    expect(screen.getByText('39')).toBeInTheDocument();
  });
});
