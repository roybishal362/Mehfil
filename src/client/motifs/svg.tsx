/**
 * Shared SVG symbols. Each drawn motif that repeats (mango leaves, shiuli flowers) is drawn
 * once here, at the app root, and placed with <use>, which keeps the DOM small. Colour that
 * varies comes through `currentColor`, never inline styles. Objects (diyas, marigolds,
 * balloons…) are 3D artwork instead (src/client/art).
 */

const SHIULI_PETALS = [0, 60, 120, 180, 240, 300];

export function SharedDefs() {
  return (
    <svg className="svg-defs" aria-hidden="true" focusable="false" width="0" height="0">
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
    </svg>
  );
}
