/**
 * Festive patterns for the moods: torans of 3D marigolds and mango leaves, bunting, string
 * lights, falling shiuli, a sunburst and alpana corners. Every piece is decorative and hidden
 * from assistive technology; motion comes from CSS classes (motifs.css), which pause until the
 * page has loaded and stop for reduced motion.
 */
import { artUrl } from '../art';

const WIDTH = 1200;

/** Points along a quadratic curve. */
function quad(
  [x0, y0]: [number, number],
  [x1, y1]: [number, number],
  [x2, y2]: [number, number],
  t: number,
): [number, number] {
  const u = 1 - t;
  return [u * u * x0 + 2 * u * t * x1 + t * t * x2, u * u * y0 + 2 * u * t * y1 + t * t * y2];
}

const round = (value: number) => Math.round(value * 10) / 10;

const STRANDS = Array.from({ length: Math.floor(WIDTH / 56) }, (_, index) => 28 + index * 56);

const MARIGOLD = artUrl('marigold', 30);

/** A toran: marigold strands and mango leaves hanging from a cord, each swaying on its own. */
export function Garland({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`garland ${className}`}
      viewBox={`0 0 ${String(WIDTH)} 72`}
      preserveAspectRatio="xMidYMin slice"
      aria-hidden="true"
      focusable="false"
    >
      <path d={`M0 6H${String(WIDTH)}`} stroke="#8a5a2b" strokeWidth="2" />
      {STRANDS.map((x, index) =>
        index % 2 === 0 ? (
          <g key={x} className="sway motion">
            <path d={`M${String(x)} 6V44`} stroke="#8a5a2b" strokeWidth="1.2" />
            <image href={MARIGOLD} x={x - 15} y={7} width="30" height="30" />
            <image href={MARIGOLD} x={x - 12} y={34} width="24" height="24" />
            <circle cx={x} cy="62" r="3" fill="#b8235a" />
          </g>
        ) : (
          <g key={x} className="sway motion">
            <use
              href="#m-leaf"
              x={x - 7.6}
              y="6"
              width="15.2"
              height="44"
              color="#4e9a62"
              transform={`rotate(-14 ${String(x)} 6)`}
            />
            <use
              href="#m-leaf"
              x={x - 8.3}
              y="6"
              width="16.6"
              height="48"
              color="#2d7a4c"
              transform={`rotate(4 ${String(x)} 6)`}
            />
          </g>
        ),
      )}
    </svg>
  );
}

const FLAG_COLOURS = ['#b8235a', '#ef8f1c', '#2a8c8a', '#e6ad12', '#5b3fa8'];
const FLAGS = Array.from({ length: Math.floor(WIDTH / 46) }, (_, index) => {
  const x = 23 + index * 46;
  const t = x / WIDTH;
  const y = 8 + 20 * Math.sin(Math.PI * (t < 0.5 ? 2 * t : 2 * t - 1));
  return { x, y: round(y), colour: FLAG_COLOURS[index % FLAG_COLOURS.length] ?? '#b8235a' };
});

/** Birthday bunting: triangular flags on a looping cord. */
export function Bunting({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`bunting ${className}`}
      viewBox={`0 0 ${String(WIDTH)} 70`}
      preserveAspectRatio="xMidYMin slice"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={`M0 8Q${String(WIDTH / 4)} 30 ${String(WIDTH / 2)} 10T${String(WIDTH)} 8`}
        fill="none"
        stroke="#6b4a2f"
        strokeWidth="1.6"
      />
      {FLAGS.map(({ x, y, colour }) => (
        <path
          key={x}
          className="flag motion"
          d={`M${String(x - 15)} ${String(y)}H${String(x + 15)}L${String(x)} ${String(round(y + 34))}Z`}
          fill={colour}
        />
      ))}
    </svg>
  );
}

const HALF = WIDTH / 2;
const BULB_COLOURS = ['#f4ebdd', '#e4c98e', '#e27b2b', '#e4c98e'];
const BULBS = (
  [
    [
      [0, 6],
      [HALF / 2, 46],
      [HALF, 14],
    ],
    [
      [HALF, 14],
      [HALF * 1.5, 46],
      [WIDTH, 6],
    ],
  ] as [number, number][][]
).flatMap((segment, s) =>
  Array.from({ length: 21 }, (_, index) => {
    const [x, y] = quad(
      segment[0] ?? [0, 0],
      segment[1] ?? [0, 0],
      segment[2] ?? [0, 0],
      (index + 1) / 22,
    );
    return { key: `${String(s)}-${String(index)}`, x: round(x), y: round(y + 7) };
  }),
);

/** A string of small lights, twinkling out of step. */
export function StringLights({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`lights ${className}`}
      viewBox={`0 0 ${String(WIDTH)} 60`}
      preserveAspectRatio="xMidYMin slice"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={`M0 6Q${String(HALF / 2)} 46 ${String(HALF)} 14Q${String(HALF * 1.5)} 46 ${String(WIDTH)} 6`}
        fill="none"
        stroke="#7a6347"
        strokeWidth="1.2"
      />
      {BULBS.map(({ key, x, y }, index) => (
        <circle
          key={key}
          className="bulb motion"
          cx={x}
          cy={y}
          r="3"
          fill={BULB_COLOURS[index % 4]}
        />
      ))}
    </svg>
  );
}

/** Shiuli flowers drifting down, as they do in the autumn of Durga Puja. */
export function ShiuliRain({ count = 8 }: { count?: number }) {
  return (
    <div className="shiuli-rain" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <svg key={index} className="shiuli motion" viewBox="-16 -16 32 34" focusable="false">
          <use href="#m-shiuli" x="-16" y="-16" width="32" height="34" />
        </svg>
      ))}
    </div>
  );
}

const RAYS = Array.from({ length: 32 }, (_, index) => round((360 * index) / 32));
const PETALS = Array.from({ length: 16 }, (_, index) => round((360 * index) / 16));

/** A sunburst that turns slowly behind Ganpati's plans. */
export function Sunburst({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`sunburst motion ${className}`}
      viewBox="-120 -120 240 240"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="currentColor">
        {RAYS.map((angle) => (
          <path key={angle} d="M0-66 4.2-120H-4.2Z" transform={`rotate(${String(angle)})`} />
        ))}
      </g>
      <g fill="none" stroke="currentColor" strokeWidth="2">
        <circle r="60" />
        <circle r="31" />
      </g>
      <g fill="currentColor" opacity=".6">
        {PETALS.map((angle) => (
          <ellipse key={angle} cy="-50" rx="8.4" ry="19" transform={`rotate(${String(angle)})`} />
        ))}
      </g>
    </svg>
  );
}

/** A corner of alpana, the white floor art of Bengal, in the mood's colour. */
export function AlpanaCorner({ className = '' }: { className?: string }) {
  return (
    <svg className={`alpana ${className}`} viewBox="0 0 80 80" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M6 78C6 36 36 6 78 6" />
        <path d="M18 78C18 44 44 18 78 18" strokeDasharray="1 5" />
        <path d="M30 78C32 54 54 32 78 30" />
        <path d="M44 44C40 34 42 26 50 22 54 30 52 38 44 44Z" />
        <path d="M44 44C34 40 26 42 22 50 30 54 38 52 44 44Z" />
      </g>
      <g fill="currentColor">
        <circle cx="12" cy="56" r="1.8" />
        <circle cx="22" cy="38" r="1.8" />
        <circle cx="38" cy="22" r="1.8" />
        <circle cx="56" cy="12" r="1.8" />
        <circle cx="46" cy="46" r="2.4" />
      </g>
    </svg>
  );
}
