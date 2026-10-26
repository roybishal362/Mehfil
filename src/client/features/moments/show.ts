/**
 * A small particle system for the celebration moments: rockets that climb and burst for Diwali,
 * and confetti from two cannons for a birthday. The physics is pure and takes its randomness as
 * a parameter, so tests can replay a show exactly; drawing runs on a canvas and stops on its own.
 */

export type Random = () => number;

/** A seeded random number generator (mulberry32), for repeatable shows in tests. */
export function seeded(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

type ParticleKind = 'rocket' | 'trail' | 'spark' | 'confetti';

export interface Particle {
  kind: ParticleKind;
  /** Position in CSS pixels. */
  x: number;
  y: number;
  /** Velocity in pixels per second. */
  vx: number;
  vy: number;
  /** Seconds lived, and seconds to live. */
  age: number;
  life: number;
  size: number;
  color: string;
  /** A second colour: what a rocket's sparks take after its own. */
  accent: string;
  /** Confetti turns as it falls (radians, radians per second). */
  angle: number;
  spin: number;
  /** The height a rocket bursts at. */
  burstY: number;
  /** Sparks that twinkle as they fade. */
  crackle: boolean;
}

/** Diwali: gold, saffron, rani pink, peacock teal and lamp white. */
export const FIREWORK_COLOURS = ['#ffd36b', '#ff9b3d', '#ff5aa5', '#4fd1c5', '#fff4d6'];
/** Birthday: the bunting's colours. */
export const CONFETTI_COLOURS = ['#d63a8a', '#1f9a94', '#e6ad12', '#ef8f1c', '#5b3fa8'];

/** Pixels per second squared pulling each kind of particle down. */
const GRAVITY: Readonly<Record<ParticleKind, number>> = {
  rocket: 0,
  trail: 40,
  spark: 150,
  confetti: 280,
};
/** How much speed each kind keeps after one second (air drag). */
const KEEP: Readonly<Record<ParticleKind, number>> = {
  rocket: 1,
  trail: 0.2,
  spark: 0.28,
  confetti: 0.4,
};

function pick<T>(items: readonly T[], random: Random): T {
  const item = items[Math.floor(random() * items.length)];
  if (item === undefined) throw new Error('pick() needs at least one item');
  return item;
}

function particle(fields: Partial<Particle> & Pick<Particle, 'kind' | 'x' | 'y'>): Particle {
  return {
    vx: 0,
    vy: 0,
    age: 0,
    life: 1,
    size: 2,
    color: '#ffffff',
    accent: '#ffffff',
    angle: 0,
    spin: 0,
    burstY: 0,
    crackle: false,
    ...fields,
  };
}

/** A rocket rising from the bottom edge, to burst somewhere in the upper half of the sky. */
export function launchRocket(random: Random, width: number, height: number): Particle {
  const burstY = height * (0.14 + random() * 0.3);
  const flight = 0.75 + random() * 0.3;
  return particle({
    kind: 'rocket',
    x: width * (0.12 + random() * 0.76),
    y: height + 8,
    vx: (random() - 0.5) * 40,
    vy: -(height + 8 - burstY) / flight,
    life: flight + 0.5,
    size: 2.6,
    color: pick(FIREWORK_COLOURS, random),
    accent: pick(FIREWORK_COLOURS, random),
    burstY,
  });
}

/** A rocket's burst: sparks thrown evenly in every direction, in its two colours. */
export function burst(rocket: Particle, random: Random, scale = 1): Particle[] {
  const count = 64 + Math.floor(random() * 28);
  return Array.from({ length: count }, (_, index) => {
    const angle = (2 * Math.PI * index) / count + random() * 0.12;
    const speed = (90 + random() * 210) * scale;
    return particle({
      kind: 'spark',
      x: rocket.x,
      y: rocket.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.9 + random() * 0.7,
      size: 1.4 + random() * 1.3,
      color: index % 3 === 0 ? rocket.accent : rocket.color,
      crackle: random() < 0.3,
    });
  });
}

/** A confetti cannon: where it stands, where it points (radians) and how hard it fires. */
interface Cannon {
  x: number;
  y: number;
  direction: number;
  scale: number;
}

/** One cannon's worth of confetti. */
function confetti({ x, y, direction, scale }: Cannon, random: Random): Particle[] {
  return Array.from({ length: 90 }, () => {
    const angle = direction + (random() - 0.5) * 0.9;
    const speed = (520 + random() * 520) * scale;
    return particle({
      kind: 'confetti',
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 2.4 + random() * 1.2,
      size: 6 + random() * 6,
      color: pick(CONFETTI_COLOURS, random),
      angle: random() * Math.PI,
      spin: (random() - 0.5) * 18,
    });
  });
}

/**
 * Moves every particle on by `dt` seconds. Rockets that reach their height burst into sparks
 * and leave a short trail on the way; anything past its life is dropped.
 */
export function step(particles: readonly Particle[], dt: number, random: Random): Particle[] {
  const next: Particle[] = [];
  for (const current of particles) {
    const keep = KEEP[current.kind] ** dt;
    const flutter = current.kind === 'confetti' ? Math.sin(current.age * 9 + current.spin) * 60 : 0;
    const moved: Particle = {
      ...current,
      vx: current.vx * keep + flutter * dt,
      vy: current.vy * keep + GRAVITY[current.kind] * dt,
      x: current.x + current.vx * dt,
      y: current.y + current.vy * dt,
      age: current.age + dt,
      angle: current.angle + current.spin * dt,
    };
    if (moved.kind === 'rocket') {
      if (moved.y <= moved.burstY) {
        next.push(...burst(moved, random));
        continue;
      }
      next.push(
        particle({
          kind: 'trail',
          x: moved.x,
          y: moved.y,
          vx: (random() - 0.5) * 30,
          vy: 30 + random() * 40,
          life: 0.35 + random() * 0.25,
          size: 1.3,
          color: '#ffe3a3',
        }),
      );
    }
    if (moved.age < moved.life) next.push(moved);
  }
  return next;
}

/** 0 to 1: how visible a particle still is. Crackling sparks flicker as they fade. */
export function opacity(item: Particle, random: Random): number {
  const left = Math.max(0, 1 - item.age / item.life);
  if (item.crackle && item.age > item.life * 0.45) return random() < 0.5 ? left : left * 0.2;
  return item.kind === 'confetti' ? Math.min(1, left * 3) : left;
}

export type ShowKind = 'fireworks' | 'confetti';

/** When each rocket or cannon fires, in seconds from the start of the show. */
const SCHEDULE: Readonly<Record<ShowKind, readonly number[]>> = {
  fireworks: [0.1, 0.35, 0.6, 0.8, 1.05, 1.3, 1.5, 1.75],
  confetti: [0.15, 0.15, 0.7, 0.7],
};

export interface Stage {
  width: number;
  height: number;
}

/** New particles for the `index`-th firing of a show. */
export function fire(kind: ShowKind, index: number, random: Random, stage: Stage): Particle[] {
  const { width, height } = stage;
  if (kind === 'fireworks') return [launchRocket(random, width, height)];
  // Cannons in the bottom corners, aimed up and inwards.
  const left = index % 2 === 0;
  const cannon: Cannon = {
    x: left ? 0 : width,
    y: height,
    direction: left ? -Math.PI / 3 : (-2 * Math.PI) / 3,
    scale: Math.min(1.2, Math.max(0.6, height / 800)),
  };
  return confetti(cannon, random);
}

function draw(context: CanvasRenderingContext2D, particles: readonly Particle[], kind: ShowKind) {
  const { width, height } = context.canvas;
  if (kind === 'fireworks') {
    // Fade the last frame instead of clearing it, which leaves glowing trails.
    context.globalCompositeOperation = 'destination-out';
    context.fillStyle = 'rgb(0 0 0 / 0.24)';
    context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = 'lighter';
  } else {
    context.clearRect(0, 0, width, height);
  }
  const random = Math.random;
  for (const item of particles) {
    context.globalAlpha = opacity(item, random);
    context.fillStyle = item.color;
    if (item.kind === 'confetti') {
      context.save();
      context.translate(item.x, item.y);
      context.rotate(item.angle);
      // Turning paper looks thinner side-on.
      context.fillRect(
        -item.size / 2,
        -item.size / 4,
        item.size,
        (item.size / 2) * Math.abs(Math.cos(item.angle * 1.7)) + 1,
      );
      context.restore();
    } else {
      context.beginPath();
      context.arc(item.x, item.y, item.size, 0, Math.PI * 2);
      context.fill();
    }
  }
  context.globalAlpha = 1;
  context.globalCompositeOperation = 'source-over';
}

/**
 * Runs a show on `canvas` (sized by CSS) and returns a function that stops it. The show ends
 * by itself once every particle has faded.
 */
export function startShow(
  canvas: HTMLCanvasElement,
  kind: ShowKind,
  random: Random = Math.random,
): () => void {
  const context = canvas.getContext('2d');
  if (!context) return () => undefined;
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  context.scale(ratio, ratio);

  const times = SCHEDULE[kind];
  let particles: Particle[] = [];
  let fired = 0;
  let elapsed = 0;
  let last: number | null = null;
  let frame = 0;
  const tick = (now: number) => {
    // A long gap (a background tab) counts as one short frame, so nothing jumps.
    const dt = last === null ? 0 : Math.min(0.05, (now - last) / 1000);
    last = now;
    elapsed += dt;
    while (fired < times.length && (times[fired] ?? Infinity) <= elapsed) {
      particles.push(...fire(kind, fired, random, { width, height }));
      fired += 1;
    }
    particles = step(particles, dt, random);
    draw(context, particles, kind);
    if (fired < times.length || particles.length > 0) frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(frame);
  };
}
