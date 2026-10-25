import { describe, expect, it, vi } from 'vitest';
import {
  CONFETTI_COLOURS,
  FIREWORK_COLOURS,
  burst,
  fire,
  launchRocket,
  opacity,
  seeded,
  startShow,
  step,
  type Particle,
} from './show';

const WIDTH = 1200;
const HEIGHT = 800;

/** Runs the physics for `seconds` in 60 fps steps. */
function run(particles: Particle[], seconds: number, random = seeded(7)): Particle[] {
  let current = particles;
  for (let time = 0; time < seconds; time += 1 / 60) current = step(current, 1 / 60, random);
  return current;
}

describe('seeded', () => {
  it('repeats the same numbers for the same seed, all between 0 and 1', () => {
    const first = Array.from({ length: 5 }, seeded(42));
    const second = Array.from({ length: 5 }, seeded(42));
    expect(first).toEqual(second);
    expect(first.every((value) => value >= 0 && value < 1)).toBe(true);
    expect(Array.from({ length: 5 }, seeded(43))).not.toEqual(first);
  });
});

describe('rockets', () => {
  it('rise from below the bottom edge to burst in the upper half', () => {
    const rocket = launchRocket(seeded(1), WIDTH, HEIGHT);
    expect(rocket.y).toBeGreaterThan(HEIGHT);
    expect(rocket.vy).toBeLessThan(0);
    expect(rocket.burstY).toBeLessThan(HEIGHT / 2);
    expect(rocket.x).toBeGreaterThan(0);
    expect(rocket.x).toBeLessThan(WIDTH);
    expect(FIREWORK_COLOURS).toContain(rocket.color);
  });

  it('leave a trail, then burst into sparks of their colours at their height', () => {
    const rocket = launchRocket(seeded(2), WIDTH, HEIGHT);
    const climbing = run([rocket], 0.2);
    expect(climbing.some((item) => item.kind === 'rocket')).toBe(true);
    expect(climbing.some((item) => item.kind === 'trail')).toBe(true);
    const burst = run([rocket], 1.3).filter((item) => item.kind === 'spark');
    expect(burst.length).toBeGreaterThanOrEqual(64);
    expect(burst.every((item) => [rocket.color, rocket.accent].includes(item.color))).toBe(true);
  });

  it('throw sparks in every direction, which then fall and fade away', () => {
    const rocket = { ...launchRocket(seeded(3), WIDTH, HEIGHT), x: 600, y: 300 };
    const sparks = burst(rocket, seeded(3));
    expect(sparks.some((item) => item.vx < 0)).toBe(true);
    expect(sparks.some((item) => item.vx > 0)).toBe(true);
    expect(sparks.some((item) => item.vy < 0)).toBe(true);
    expect(sparks.some((item) => item.vy > 0)).toBe(true);
    const later = run(sparks, 0.6);
    const fallingFaster = later.filter((item) => item.vy > 0).length;
    expect(fallingFaster).toBeGreaterThan(sparks.filter((item) => item.vy > 0).length);
    expect(run(sparks, 2)).toEqual([]);
  });
});

describe('confetti', () => {
  it('fires from the bottom corners, upwards and inwards', () => {
    const left = fire('confetti', 0, seeded(4), WIDTH, HEIGHT);
    const right = fire('confetti', 1, seeded(4), WIDTH, HEIGHT);
    expect(left).toHaveLength(90);
    expect(left.every((item) => item.x === 0 && item.y === HEIGHT)).toBe(true);
    expect(right.every((item) => item.x === WIDTH)).toBe(true);
    const average = (items: Particle[], key: 'vx' | 'vy') =>
      items.reduce((sum, item) => sum + item[key], 0) / items.length;
    expect(average(left, 'vx')).toBeGreaterThan(0);
    expect(average(right, 'vx')).toBeLessThan(0);
    expect(average(left, 'vy')).toBeLessThan(0);
    expect(left.every((item) => CONFETTI_COLOURS.includes(item.color))).toBe(true);
  });

  it('turns as it falls back down', () => {
    const pieces = fire('confetti', 0, seeded(5), WIDTH, HEIGHT);
    const later = run(pieces, 2.2);
    expect(later.length).toBeGreaterThan(0);
    expect(later.every((item) => item.vy > 0)).toBe(true);
    const turned = later.filter((item, index) => item.angle !== pieces[index]?.angle);
    expect(turned.length).toBeGreaterThan(0);
  });
});

describe('opacity', () => {
  it('fades from full to nothing over a particle’s life', () => {
    const rocket = launchRocket(seeded(6), WIDTH, HEIGHT);
    const [spark] = burst({ ...rocket, x: 0, y: 0 }, seeded(6)).filter((item) => !item.crackle);
    if (!spark) throw new Error('expected a spark');
    expect(opacity(spark, seeded(1))).toBe(1);
    expect(opacity({ ...spark, age: spark.life / 2 }, seeded(1))).toBeCloseTo(0.5);
    expect(opacity({ ...spark, age: spark.life }, seeded(1))).toBe(0);
  });

  it('makes crackling sparks flicker as they fade', () => {
    const rocket = launchRocket(seeded(8), WIDTH, HEIGHT);
    const crackle = burst(rocket, seeded(8)).find((item) => item.crackle);
    if (!crackle) throw new Error('expected a crackling spark');
    const late = { ...crackle, age: crackle.life * 0.6 };
    const values = new Set(Array.from({ length: 20 }, () => opacity(late, Math.random)));
    expect(values.size).toBe(2);
  });
});

/** A 2D context that only counts what it is asked to draw. */
function fakeContext(canvas: HTMLCanvasElement) {
  const calls = { arc: 0, fillRect: 0, clearRect: 0, rotate: 0 };
  const context = {
    canvas,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillStyle: '',
    scale: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: () => {
      calls.rotate += 1;
    },
    beginPath: vi.fn(),
    fill: vi.fn(),
    arc: () => {
      calls.arc += 1;
    },
    fillRect: () => {
      calls.fillRect += 1;
    },
    clearRect: () => {
      calls.clearRect += 1;
    },
  };
  return { context, calls };
}

/** Runs requestAnimationFrame by hand, one 1/60 s frame per call. */
function frames() {
  let pending: FrameRequestCallback[] = [];
  let time = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    pending.push(callback);
    return pending.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {
    pending = [];
  });
  return {
    run(count: number) {
      for (let index = 0; index < count && pending.length > 0; index += 1) {
        const due = pending;
        pending = [];
        time += 1000 / 60;
        for (const callback of due) callback(time);
      }
    },
    get waiting() {
      return pending.length;
    },
  };
}

describe('startShow', () => {
  it('launches rockets, draws their bursts with trails, and ends by itself', () => {
    const canvas = document.createElement('canvas');
    const { context, calls } = fakeContext(canvas);
    vi.spyOn(canvas, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
    const clock = frames();
    startShow(canvas, 'fireworks', seeded(11));
    clock.run(90);
    // Each frame fades the last one (fillRect) and draws particles as dots.
    expect(calls.fillRect).toBeGreaterThan(80);
    expect(calls.arc).toBeGreaterThan(500);
    clock.run(600);
    expect(clock.waiting).toBe(0);
  });

  it('throws turning confetti, cleared each frame, until it can be stopped', () => {
    const canvas = document.createElement('canvas');
    const { context, calls } = fakeContext(canvas);
    vi.spyOn(canvas, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
    const clock = frames();
    const stop = startShow(canvas, 'confetti', seeded(12));
    clock.run(60);
    expect(calls.clearRect).toBeGreaterThan(50);
    expect(calls.rotate).toBeGreaterThan(1000);
    stop();
    expect(clock.waiting).toBe(0);
  });

  it('does nothing, safely, where a canvas cannot draw', () => {
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getContext').mockReturnValue(null);
    const stop = startShow(canvas, 'fireworks');
    expect(() => {
      stop();
    }).not.toThrow();
  });
});
