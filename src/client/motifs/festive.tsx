/**
 * Festive motifs for the moods, drawn in flat colour from the shared symbols (svg.tsx). Every
 * piece is decorative and hidden from assistive technology; motion comes from CSS classes
 * (motifs.css), which pause until the page has loaded and stop for reduced motion.
 */

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
            <use
              href={index % 4 === 0 ? '#m-marigold' : '#m-marigold-gold'}
              x={x - 14.7}
              y={7.3}
              width="29.4"
              height="29.4"
            />
            <use
              href={index % 4 === 0 ? '#m-marigold' : '#m-marigold-gold'}
              x={x - 11.5}
              y={34.5}
              width="23"
              height="23"
            />
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

const KANDILS = [
  { cord: 30, variant: 'red' },
  { cord: 110, variant: 'saffron' },
  { cord: 60, variant: 'teal' },
] as const;

/** Three papercut kandils hanging on cords of different lengths. */
export function Kandils({ className = '' }: { className?: string }) {
  return (
    <div className={`kandils ${className}`} aria-hidden="true">
      {KANDILS.map(({ cord, variant }) => (
        <svg
          key={variant}
          className={`kandil kandil--${variant} motion`}
          viewBox={`0 -${String(cord)} 100 ${String(230 + cord)}`}
          focusable="false"
        >
          <path d={`M50 -${String(cord)}V0`} stroke="#7a6347" strokeWidth="1.4" />
          <use href="#m-kandil" width="100" height="230" />
        </svg>
      ))}
    </div>
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

const PLUME = [-26, -16, -7, 0, 7, 16, 26];

/** The dhak, Durga Puja's great drum, with its plume of kash flowers. */
export function Dhak({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`dhak ${className}`}
      viewBox="0 -14 120 102"
      aria-hidden="true"
      focusable="false"
    >
      <g className="plume motion">
        {PLUME.map((dx) => (
          <path
            key={dx}
            d={`M60 34C${String(60 + dx * 0.4)} 20 ${String(60 + dx)} 6 ${String(60 + dx * 1.2)} -6`}
            fill="none"
            stroke="#f3ead8"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        ))}
        {PLUME.map((dx) => (
          <path
            key={`edge${String(dx)}`}
            d={`M60 34C${String(60 + dx * 0.4)} 20 ${String(60 + dx)} 6 ${String(60 + dx * 1.2)} -6`}
            fill="none"
            stroke="#bfae92"
            strokeWidth=".6"
          />
        ))}
      </g>
      <path d="M18 40C30 30 90 30 102 40V76C90 86 30 86 18 76Z" fill="#b8141f" />
      <ellipse cx="18" cy="58" rx="8" ry="18" fill="#f3e7d3" stroke="#7a1010" strokeWidth="2" />
      <ellipse cx="102" cy="58" rx="8" ry="18" fill="#f3e7d3" stroke="#7a1010" strokeWidth="2" />
      <path d="M30 38V80M48 35V83M72 35V83M90 38V80" stroke="#fffaf0" strokeWidth="2.4" />
      <path d="M24 44 96 72M24 72 96 44" stroke="#e8b04a" strokeWidth="1.4" />
    </svg>
  );
}

/** Three modaks, Ganpati's favourite sweet, stacked as an offering. */
export function ModakStack({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`modaks ${className}`}
      viewBox="16 40 88 70"
      aria-hidden="true"
      focusable="false"
    >
      <use href="#m-modak" x="25" y="74" width="30" height="37" />
      <use href="#m-modak" x="65" y="74" width="30" height="37" />
      <use href="#m-modak" x="43.5" y="42" width="33" height="40.7" />
    </svg>
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

const BALLOONS = ['pink', 'teal', 'gold'] as const;

/** Balloons bobbing on their strings. */
export function Balloons({ className = '' }: { className?: string }) {
  return (
    <div className={`balloons ${className}`} aria-hidden="true">
      {BALLOONS.map((colour) => (
        <svg
          key={colour}
          className={`balloon balloon--${colour} motion`}
          viewBox="0 0 60 150"
          focusable="false"
        >
          <use href="#m-balloon" width="60" height="150" />
        </svg>
      ))}
    </div>
  );
}

const KALASH_LEAVES = [-70, -40, -12, 12, 40, 70];

/** A kalash with mango leaves and a coconut: the auspicious start of a wedding. */
export function Kalash() {
  return (
    <g>
      {KALASH_LEAVES.map((angle) => (
        <use
          key={angle}
          href="#m-leaf"
          x="52"
          y="30"
          width="12"
          height="34"
          color="#2d7a4c"
          transform={`rotate(${String(angle)} 60 30)`}
        />
      ))}
      <circle cx="60" cy="30" r="14" fill="#8a5a2b" />
      <path d="M48 22C54 14 66 14 72 22" stroke="#b07a45" strokeWidth="2" fill="none" />
      <path
        d="M36 50C36 44 84 44 84 50L80 58C96 66 98 92 86 104 76 114 44 114 34 104 22 92 24 66 40 58Z"
        fill="#c98a2e"
      />
      <path d="M30 78C44 84 76 84 90 78" stroke="#8b1912" strokeWidth="5" fill="none" />
      <circle cx="60" cy="90" r="5" fill="#b3241c" />
    </g>
  );
}

const CANDLES = [44, 58, 72];

/** A birthday cake with three flickering candles. */
export function Cake() {
  return (
    <g>
      <rect x="30" y="66" width="60" height="34" rx="5" fill="#f7d9e6" />
      <rect x="30" y="66" width="60" height="9" rx="4" fill="#b8235a" />
      <path d="M30 84q7.5 6 15 0t15 0 15 0 15 0" fill="none" stroke="#fffaf0" strokeWidth="3" />
      <rect x="24" y="100" width="72" height="6" rx="3" fill="#8a6d4e" />
      {CANDLES.map((x) => (
        <g key={x}>
          <rect x={x} y="50" width="4" height="16" rx="1.5" fill="#e6ad12" />
          <path
            className="flame motion"
            d={`M${String(x + 2)} 49c-3-3-3-6 0-10 3 4 3 7 0 10Z`}
            fill="#e7a33d"
          />
        </g>
      ))}
    </g>
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
