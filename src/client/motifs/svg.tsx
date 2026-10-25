/**
 * Shared SVG symbols. Each motif that repeats (marigolds, leaves, shiuli flowers, diyas,
 * kandils, modaks, balloons) is drawn once here, at the app root, and placed with <use>, which
 * keeps the DOM small. Colour that varies comes through `currentColor`, never inline styles.
 */

/** Points on a ring, starting at 3 o'clock, as [x, y] pairs rounded to 0.01. */
function ring(radius: number, count: number, phase = 0): [number, number][] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (2 * Math.PI * index) / count + phase;
    return [
      Math.round(Math.cos(angle) * radius * 100) / 100,
      Math.round(Math.sin(angle) * radius * 100) / 100,
    ];
  });
}

const OUTER = ring(10.5, 14);
const MIDDLE = ring(6.6, 10, 0.3);

function Marigold({ id, outer, middle, core }: Record<'id' | 'outer' | 'middle' | 'core', string>) {
  return (
    <symbol id={id} viewBox="-16 -16 32 32">
      {OUTER.map(([x, y], index) => (
        <circle key={`o${String(index)}`} cx={x} cy={y} r="5.2" fill={outer} />
      ))}
      {MIDDLE.map(([x, y], index) => (
        <circle key={`m${String(index)}`} cx={x} cy={y} r="4.3" fill={middle} />
      ))}
      <circle r="4.6" fill={core} />
      <circle r="1.6" fill="#7a3507" />
    </symbol>
  );
}

const SHIULI_PETALS = [0, 60, 120, 180, 240, 300];

export function SharedDefs() {
  return (
    <svg className="svg-defs" aria-hidden="true" focusable="false" width="0" height="0">
      <Marigold id="m-marigold" outer="#ef8f1c" middle="#f7a93a" core="#d4690c" />
      <Marigold id="m-marigold-gold" outer="#e6ad12" middle="#f3c94c" core="#c98a0e" />
      {/* A mango leaf hanging from its stalk at the top centre. */}
      <symbol id="m-leaf" viewBox="-9 0 18 52">
        <path d="M0 1C8 13 8 34 0 51-8 34-8 13 0 1Z" fill="currentColor" />
        <path d="M0 3v46" stroke="#1d5634" strokeWidth="1.1" />
      </symbol>
      {/* Shiuli, the night jasmine of Durga Puja: white petals, a saffron heart and stem. */}
      <symbol id="m-shiuli" viewBox="-16 -16 32 34">
        {SHIULI_PETALS.map((angle) => (
          <path
            key={angle}
            d="M0 0C4-3 5-10 1-14-2-10-3-4 0 0Z"
            transform={`rotate(${String(angle)})`}
            fill="#fffaf0"
            stroke="#d8c8ae"
            strokeWidth=".6"
          />
        ))}
        <circle r="2.8" fill="#f08a1e" />
        <path d="M0 2 3 14" stroke="#f08a1e" strokeWidth="2" strokeLinecap="round" />
      </symbol>
      {/* A clay diya; the flame is its own group so it can flicker. */}
      <symbol id="m-diya" viewBox="0 0 40 40">
        <path d="M4 24c3 8 9 12 16 12s13-4 16-12Z" fill="#a8532a" />
        <path d="M4 24h32" stroke="#7a3a1c" strokeWidth="1.5" />
        <g className="flame motion">
          <path d="M20 21c-4-4-4-9 0-16 4 7 4 12 0 16Z" fill="#e7a33d" />
          <path d="M20 18c-1.6-1.8-1.6-4.2 0-7 1.6 2.8 1.6 5.2 0 7Z" fill="#fbe3a6" />
        </g>
      </symbol>
      {/* A papercut kandil: light shows through its cut-outs; the body takes currentColor. */}
      <symbol id="m-kandil" viewBox="0 0 100 230">
        <path d="M38 0h24l8 12H30Z" fill="#c9a35a" />
        <path d="M30 12h40l16 52-16 52H30L14 64Z" fill="currentColor" />
        <g fill="#f6cf86">
          <path d="M50 22l7 10-7 10-7-10Z" />
          <path d="M50 52l9 12-9 12-9-12Z" />
          <path d="M50 86l7 10-7 10-7-10Z" />
          <circle cx="31" cy="50" r="2.8" />
          <circle cx="31" cy="64" r="2.8" />
          <circle cx="31" cy="78" r="2.8" />
          <circle cx="69" cy="50" r="2.8" />
          <circle cx="69" cy="64" r="2.8" />
          <circle cx="69" cy="78" r="2.8" />
        </g>
        <path
          d="M30 12 14 64l16 52M70 12l16 52-16 52M30 12v104M70 12v104"
          fill="none"
          stroke="#000"
          strokeOpacity=".22"
        />
        <path d="M32 116h36l-6 10H38Z" fill="#c9a35a" />
        <circle cx="50" cy="132" r="4" fill="#c9a35a" />
        <path d="M44 136h12l3 50H41Z" fill="currentColor" />
        <path d="M46.5 140v44M50 140v46M53.5 140v44" stroke="#000" strokeOpacity=".25" />
      </symbol>
      {/* A modak, Ganpati's sweet: a pleated dumpling. */}
      <symbol id="m-modak" viewBox="-15 -18 30 37">
        <path
          d="M0-16C6-6 13 2 13 9 13 15 6 17 0 17-6 17-13 15-13 9-13 2-6-6 0-16Z"
          fill="#f3e1b8"
          stroke="#c98a3a"
          strokeWidth="1.2"
        />
        <path
          d="M0-15Q-8 2-9.2 15M0-15Q-3.5 2-4 15M0-15V15M0-15Q3.5 2 4 15M0-15Q8 2 9.2 15"
          fill="none"
          stroke="#c98a3a"
        />
      </symbol>
      {/* A balloon on its string; the balloon takes currentColor. */}
      <symbol id="m-balloon" viewBox="0 0 60 150">
        <ellipse cx="30" cy="30" rx="24" ry="29" fill="currentColor" />
        <ellipse
          cx="21"
          cy="19"
          rx="5"
          ry="9"
          fill="#fff"
          opacity=".28"
          transform="rotate(-20 21 19)"
        />
        <path d="M27 58h6l-3 6Z" fill="currentColor" />
        <path
          d="M30 64C22 84 38 100 28 120S32 140 30 150"
          fill="none"
          stroke="#8a6d4e"
          strokeWidth="1.2"
        />
      </symbol>
    </svg>
  );
}
