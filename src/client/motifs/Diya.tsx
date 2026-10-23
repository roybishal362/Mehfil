/** The diya (clay oil lamp): lit when a part of the plan has begun. */

const FLAME_OUTER = 'M0 -58 C 10 -42, 11 -29, 0 -18 C -11 -29, -10 -42, 0 -58 Z';
const FLAME_INNER = 'M0 -48 C 6 -38, 6 -29, 0 -21 C -6 -29, -6 -38, 0 -48 Z';
const BOWL = 'M-26 -12 C -24 4, 24 4, 26 -12 C 18 -6, -18 -6, -26 -12Z';
const RIM = 'M-26 -12 C -18 -17, 18 -17, 26 -12 C 18 -8, -18 -8, -26 -12Z';
const SPOUT = 'M26 -12 L33 -16 L28 -9Z';
const DOTS = [-16, -8, 0, 8, 16];

/** The lamp drawn around (0, 0) in a -30..30 × -64..12 box, for use inside other SVGs. */
export function DiyaShape({ lit }: { lit: boolean }) {
  return (
    <g>
      {lit && (
        <>
          <circle cy={-22} r={34} fill="url(#m-diya-glow)" className="glow" />
          <path className="flame" d={FLAME_OUTER} fill="#F59E0B" />
          <path className="flame" d={FLAME_INNER} fill="#FDE68A" />
          <ellipse className="flame" cx={0} cy={-24} rx={2.4} ry={4} fill="#FFFBEB" />
        </>
      )}
      <path d={BOWL} fill="url(#m-diya-bowl)" />
      <path d={RIM} fill="#7A2E14" />
      <path d={SPOUT} fill="#A9452A" />
      <g fill="#F6D27A">
        {DOTS.map((x) => (
          <circle key={x} cx={x} cy={-3} r={1.4} />
        ))}
      </g>
    </g>
  );
}

export function Diya({ lit = true }: { lit?: boolean }) {
  return (
    <svg viewBox="-30 -64 60 76" aria-hidden="true" focusable="false">
      <DiyaShape lit={lit} />
    </svg>
  );
}

/** A row of lit lamps on a carved ledge, closing the hero. stage.css staggers their flames. */
export function DiyaLedge({ count = 16 }: { count?: number }) {
  return (
    <div className="ledge" aria-hidden="true">
      <div className="ledge-row">
        {Array.from({ length: count }, (_, index) => (
          <Diya key={index} />
        ))}
      </div>
    </div>
  );
}

/** The brand mark: a small lit diya. */
export function BrandMark() {
  return (
    <svg viewBox="-30 -52 60 64" aria-hidden="true" focusable="false">
      <circle cy={-20} r={26} fill="url(#m-brand-glow)" />
      <path
        className="flame"
        d="M0 -44 C 9 -30, 10 -19, 0 -9 C -10 -19, -9 -30, 0 -44 Z"
        fill="#F59E0B"
      />
      <path
        className="flame"
        d="M0 -36 C 5 -27, 5 -19, 0 -12 C -5 -19, -5 -27, 0 -36 Z"
        fill="#FDE68A"
      />
      <path d="M-24 -6 Q 0 16 24 -6 Z" fill="url(#m-diya-bowl)" />
      <path d="M-25 -6 H 25" stroke="#F6D27A" strokeWidth={2.4} strokeLinecap="round" />
    </svg>
  );
}

/** The small lamp used as an icon beside "Ask Mehfil" and "Copilot". */
export function LampIcon({ size = 30 }: { size?: number }) {
  return (
    <svg
      viewBox="-30 -52 60 64"
      width={size}
      height={size * 1.07}
      aria-hidden="true"
      focusable="false"
    >
      <path
        className="flame"
        d="M0 -44 C 9 -30, 10 -19, 0 -9 C -10 -19, -9 -30, 0 -44 Z"
        fill="#F59E0B"
      />
      <path d="M-24 -6 Q 0 16 24 -6 Z" fill="#B4532A" />
      <path d="M-25 -6 H 25" stroke="#F6D27A" strokeWidth={2.4} strokeLinecap="round" />
    </svg>
  );
}
