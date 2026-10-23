/** Small decorative pieces: the invitation's emblem, seal, corners and dividers. */
import { round1 } from './svg';

/** The lotus finial that crowns the describe card. */
export function Finial() {
  return (
    <svg className="finial" viewBox="-22 -22 44 44" aria-hidden="true" focusable="false">
      <circle r={20} fill="#2A1146" stroke="#F6D27A" strokeWidth={1.5} />
      <g fill="#F6D27A">
        {[0, 72, 144, 216, 288].map((angle) => (
          <path
            key={angle}
            d="M0 -14 C5 -8 5 -3 0 2 C-5 -3 -5 -8 0 -14Z"
            transform={`rotate(${String(angle)})`}
          />
        ))}
      </g>
      <circle r={3.5} fill="#E0457B" />
    </svg>
  );
}

/** The lotus medallion at the top of the invitation card. */
export function Emblem() {
  return (
    <svg className="emblem" viewBox="-40 -40 80 80" aria-hidden="true" focusable="false">
      <circle r={36} fill="#5A0E22" stroke="#F6D27A" strokeWidth={2} />
      <circle r={30} fill="none" stroke="#F6D27A" strokeWidth={0.8} strokeDasharray="1 3" />
      {Array.from({ length: 8 }, (_, index) => (
        <path
          key={index}
          d="M0 -6 C 6 -12, 7 -18, 0 -26 C -7 -18, -6 -12, 0 -6Z"
          transform={`rotate(${String(index * 45)})`}
          fill={index % 2 ? '#E9C26A' : '#F6D27A'}
        />
      ))}
      <circle r={5} fill="#E0457B" stroke="#F6D27A" strokeWidth={1} />
    </svg>
  );
}

/** Scalloped gold edge of the countdown seal, computed once. */
const SEAL_EDGE = (() => {
  const bumps = 28;
  const points = Array.from({ length: bumps * 2 + 1 }, (_, index) => {
    const angle = (index * Math.PI) / bumps;
    const radius = index % 2 ? 78 : 86;
    return `${index ? 'L' : 'M'}${String(round1(Math.sin(angle) * radius))} ${String(round1(-Math.cos(angle) * radius))}`;
  });
  return `${points.join('')}Z`;
})();

/** The gold wax-seal disc behind the countdown. */
export function SealDisc() {
  return (
    <svg viewBox="-90 -90 180 180" aria-hidden="true" focusable="false">
      <path d={SEAL_EDGE} fill="url(#m-seal)" />
      <circle r={68} fill="none" stroke="#7A4E12" strokeWidth={1.2} strokeDasharray="2 3" />
      <circle r={60} fill="#FCEBC8" stroke="#9C6B1E" strokeWidth={1.5} />
      <circle r={54} fill="none" stroke="#C9A15A" strokeWidth={0.8} />
    </svg>
  );
}

/** Gold filigree for the invitation's lower corners. */
export function Paisley({ side }: { side: 'left' | 'right' }) {
  return (
    <svg
      className={`paisley paisley--${side}`}
      viewBox="0 0 90 90"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 82 H74 M8 82 V16" strokeWidth={1.4} />
        <path d="M14 76 H60 M14 76 V30" strokeWidth={0.8} opacity={0.7} />
        <path
          d="M8 82 C 24 82, 32 74, 32 62 C 32 52, 24 47, 18 51 C 13 54, 14 61, 20 61"
          strokeWidth={1.6}
        />
        <path d="M8 82 C 8 66, 16 58, 28 58" strokeWidth={1.1} opacity={0.8} />
        <path
          d="M44 82 C 48 74, 56 72, 62 74 C 58 80, 50 82, 44 82Z"
          fill="currentColor"
          stroke="none"
          opacity={0.9}
        />
        <path
          d="M8 46 C 16 42, 18 34, 16 28 C 10 32, 8 38, 8 46Z"
          fill="currentColor"
          stroke="none"
          opacity={0.9}
        />
      </g>
      <g fill="currentColor">
        <path d="M8 82 m0 -7 c3 3 3 4 0 7 c-3 -3 -3 -4 0 -7Z M8 82 m7 0 c-3 3 -4 3 -7 0 c3 -3 4 -3 7 0Z" />
        <circle cx={40} cy={70} r={1.6} />
        <circle cx={46} cy={66} r={1.2} />
        <circle cx={20} cy={40} r={1.6} />
        <circle cx={24} cy={34} r={1.2} />
      </g>
    </svg>
  );
}

/** The knot ornament under the place line. */
export function Ornament() {
  return (
    <svg className="ornament" viewBox="0 0 180 20" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round">
        <path d="M2 10 H66 M114 10 H178" />
        <path d="M70 10 C 76 2, 84 2, 90 10 C 96 18, 104 18, 110 10 C 104 2, 96 2, 90 10 C 84 18, 76 18, 70 10Z" />
      </g>
      <circle cx={90} cy={10} r={2.2} fill="currentColor" />
    </svg>
  );
}

/** Section divider: a gold diamond between two rules. */
export function Divider() {
  return (
    <div className="divider" aria-hidden="true">
      <svg width="54" height="22" viewBox="0 0 54 22" focusable="false">
        <g fill="currentColor">
          <path d="M27 1 L33 11 L27 21 L21 11Z" />
          <circle cx={12} cy={11} r={3} />
          <circle cx={42} cy={11} r={3} />
          <circle cx={3} cy={11} r={1.6} />
          <circle cx={51} cy={11} r={1.6} />
        </g>
      </svg>
    </div>
  );
}

/** The little arrow flourish either side of the hero eyebrow. */
export function Flank() {
  return (
    <svg className="flank" viewBox="0 0 42 10" aria-hidden="true" focusable="false">
      <path
        d="M0 5 H30 M32 5 l5 -4 l5 4 l-5 4z"
        stroke="currentColor"
        fill="currentColor"
        strokeWidth={1}
      />
    </svg>
  );
}
