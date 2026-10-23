/**
 * The decorations of the night stage: stars, string lights, hanging kandils and sparkles.
 * Geometry is computed once (deterministically) so rendering stays pure. Anything that would
 * need an inline style (placement, animation timing) lives in stage.css instead: index.html
 * carries a prerendered copy of the home page, and the Content-Security-Policy blocks inline
 * style attributes there.
 */
import type { CSSProperties } from 'react';
import { useHydrated } from '../lib/hydration';
import { LANTERN_COLORS, lanternGradient, lanternHalo, round1 } from './svg';

// ------------------------------------------------------------------ string lights

/** The light string droops in four arcs across a 1440-wide view box. */
const ARC_WIDTH = 360;
const ARCS = 4;
const BULBS_PER_ARC = 12;
const BULB_COLORS = ['#FFE9B0', '#FFD0D8', '#BFF3EC', '#FFE9B0', '#E8D6FF'];

/** Point on one arc's cubic Bézier: (0,4) → (120,44) → (240,44) → (360,4). */
function arcPoint(t: number): [number, number] {
  const u = 1 - t;
  const x = 3 * u * u * t * 120 + 3 * u * t * t * 240 + t * t * t * ARC_WIDTH;
  const y = u * u * u * 4 + 3 * u * u * t * 44 + 3 * u * t * t * 44 + t * t * t * 4;
  return [x, y];
}

const BULBS = Array.from({ length: ARCS * BULBS_PER_ARC + 1 }, (_, index) => {
  const arc = Math.min(ARCS - 1, Math.floor(index / BULBS_PER_ARC));
  const t = index === ARCS * BULBS_PER_ARC ? 1 : (index % BULBS_PER_ARC) / BULBS_PER_ARC;
  const [x, y] = arcPoint(t);
  return {
    x: round1(x + arc * ARC_WIDTH),
    y: round1(y + 5),
    color: BULB_COLORS[index % BULB_COLORS.length] ?? '#FFE9B0',
  };
});

const STRING_PATH = Array.from(
  { length: ARCS },
  (_, arc) =>
    `${arc === 0 ? 'M0 4 ' : ''}C ${String(arc * 360 + 120)} 44, ${String(arc * 360 + 240)} 44, ${String((arc + 1) * 360)} 4`,
).join(' ');

export function StringLights() {
  return (
    <div className="lights" aria-hidden="true">
      <svg viewBox="0 0 1440 70" preserveAspectRatio="xMidYMin slice" focusable="false">
        <path d={STRING_PATH} fill="none" stroke="#4B3A78" strokeWidth={1.4} />
        {BULBS.map((bulb) => (
          <g key={`${String(bulb.x)}-${String(bulb.y)}`}>
            <circle cx={bulb.x} cy={bulb.y} r={11} fill="url(#m-bulb)" />
            <circle className="bulb" cx={bulb.x} cy={bulb.y} r={2.6} fill={bulb.color} />
          </g>
        ))}
      </svg>
    </div>
  );
}

// ------------------------------------------------------------------ lanterns

/** [colour index, scale] of each kandil; .lantern--1 to --4 in stage.css hang them clear of the text. */
const LANTERNS: readonly (readonly [number, number])[] = [
  [0, 0.8],
  [1, 0.62],
  [2, 0.82],
  [3, 0.72],
];

function LanternShape({ colour }: { colour: number }) {
  return (
    <>
      <circle cx={0} cy={100} r={70} fill={`url(#${lanternHalo(colour)})`} className="glow" />
      <path d="M0 0 V54" stroke="#C9A15A" strokeWidth={1.4} />
      <path d="M-12 54 H12 L16 62 H-16Z" fill="#E2B24E" />
      <path
        d="M-16 62 C -40 80, -40 124, -16 142 H16 C 40 124, 40 80, 16 62Z"
        fill={`url(#${lanternGradient(colour)})`}
      />
      <g fill="none" stroke="rgba(110,20,30,.38)" strokeWidth={1.2}>
        <path d="M-6 62 C -16 84, -16 120, -6 142" />
        <path d="M6 62 C 16 84, 16 120, 6 142" />
        <path d="M0 62 V142" />
      </g>
      <path
        d="M-30 86 H30 M-32 118 H32"
        stroke="rgba(255,236,170,.65)"
        strokeWidth={2}
        strokeDasharray="1 5"
        strokeLinecap="round"
      />
      <path d="M-16 142 H16 L12 150 H-12Z" fill="#E2B24E" />
      <g stroke="#E2B24E" strokeWidth={1.4}>
        <path d="M0 150 V172" />
        <path d="M-5 152 L-8 176" />
        <path d="M5 152 L8 176" />
        <path d="M-2 152 L-3 178" />
        <path d="M2 152 L3 178" />
      </g>
      <circle cx={0} cy={152} r={3} fill="#F6D27A" />
    </>
  );
}

export function Lanterns() {
  return (
    <div className="lanterns" aria-hidden="true">
      {LANTERNS.map(([colour, scale], index) => (
        <div key={colour} className={`lantern lantern--${String(index + 1)}`}>
          <svg viewBox="-40 0 80 190" width={80 * scale} height={190 * scale} focusable="false">
            <LanternShape colour={colour % LANTERN_COLORS.length} />
          </svg>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ sparkles

/** Small deterministic random generator (mulberry32), so sparkles look random but stay pure. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = seeded(2027);
const SPARKS = Array.from({ length: 24 }, (_, index) => {
  const size = round1(random() * 2.5 + 1.5);
  return {
    id: index,
    style: {
      left: `${String(round1(random() * 100))}%`,
      width: size,
      height: size,
      animationDuration: `${String(round1(9 + random() * 10))}s`,
      animationDelay: `${String(round1(-random() * 16))}s`,
      '--drift': `${String(Math.round(random() * 120 - 60))}px`,
    } as CSSProperties,
  };
});

/**
 * Rising sparks. They join once the page is live: React then sets their styles through the
 * DOM, which the Content-Security-Policy allows, and the prerendered HTML stays smaller.
 */
export function Sparkles() {
  const hydrated = useHydrated();
  return (
    <div className="sparkles" aria-hidden="true">
      {hydrated && SPARKS.map((spark) => <i key={spark.id} style={spark.style} />)}
    </div>
  );
}

export function Stars() {
  return <div className="stars" aria-hidden="true" />;
}
