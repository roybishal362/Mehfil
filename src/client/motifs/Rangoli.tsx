/**
 * The plan rangoli: one powder-coloured petal per part of the plan, filled to its progress,
 * with a diya at each petal tip that is lit once that part has begun. The outer ring of rice
 * dots and scallops turns slowly. Static geometry is computed once at module load.
 */
import { DiyaShape } from './Diya';
import { polar, round1, useSvgId } from './svg';

export interface RangoliPetal {
  key: string;
  label: string;
  /** Progress from 0 to 1. */
  value: number;
  color: string;
  /** Text under the label, e.g. "35%" or "not started". */
  caption: string;
}

const RING_DOTS = Array.from({ length: 72 }, (_, index) => {
  const [x, y] = polar(index * 5, 262);
  const big = index % 3 === 0;
  return { x: round1(x), y: round1(y), r: big ? 3.2 : 1.8, opacity: big ? 0.95 : 0.6 };
});
const SCALLOP = 'M0 -244 C 9 -234, 9 -226, 0 -218 C -9 -226, -9 -234, 0 -244Z';
const LEAF = 'M0 -64 C 26 -92, 30 -128, 0 -162 C -30 -128, -26 -92, 0 -64Z';
const PETAL = 'M0 -58 C 54 -92, 64 -158, 0 -204 C -64 -158, -54 -92, 0 -58Z';
const PETAL_INNER = 'M0 -80 C 22 -104, 24 -140, 0 -170 C -24 -140, -22 -104, 0 -80Z';
const LOTUS_OUTER = 'M0 -24 C 10 -34, 11 -46, 0 -58 C -11 -46, -10 -34, 0 -24Z';
const LOTUS_INNER = 'M0 -14 C 6 -20, 7 -28, 0 -36 C -7 -28, -6 -20, 0 -14Z';
const POWDER = '#FFF6E0';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export interface RangoliProps {
  petals: readonly RangoliPetal[];
  /** Accessible description of the progress; omit to make the drawing decorative. */
  label?: string;
  showLabels?: boolean;
  className?: string;
}

export function Rangoli({
  petals,
  label,
  showLabels = false,
  className = 'rangoli',
}: RangoliProps) {
  const id = useSvgId('r');
  const count = Math.max(1, petals.length);
  const step = 360 / count;
  return (
    <svg
      className={className}
      viewBox="-300 -300 600 600"
      focusable="false"
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      <defs>
        {petals.map((petal, index) => {
          const fill = String(clamp01(petal.value));
          return (
            <linearGradient
              key={petal.key}
              id={`${id}-p${String(index)}`}
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="-60"
              x2="0"
              y2="-200"
            >
              <stop offset="0" stopColor={petal.color} />
              <stop offset={fill} stopColor={petal.color} />
              <stop offset={fill} stopColor={petal.color} stopOpacity=".36" />
              <stop offset="1" stopColor={petal.color} stopOpacity=".36" />
            </linearGradient>
          );
        })}
      </defs>
      <circle r={292} fill="url(#m-rangoli-halo)" />
      <g className="ring">
        {RING_DOTS.map((dot) => (
          <circle
            key={`${String(dot.x)},${String(dot.y)}`}
            cx={dot.x}
            cy={dot.y}
            r={dot.r}
            fill={POWDER}
            opacity={dot.opacity}
          />
        ))}
        {Array.from({ length: 36 }, (_, index) => (
          <path
            key={index}
            d={SCALLOP}
            transform={`rotate(${String(index * 10)})`}
            fill={index % 2 ? '#E0457B' : '#F7B500'}
            opacity={0.9}
          />
        ))}
      </g>
      <circle
        r={212}
        fill="none"
        stroke={POWDER}
        strokeWidth={1.6}
        strokeDasharray="0.1 9"
        strokeLinecap="round"
      />
      {petals.map((petal, index) => (
        <g key={`leaf-${petal.key}`} transform={`rotate(${String(index * step + step / 2)})`}>
          <path d={LEAF} fill="#1F7A54" />
          <path
            d={LEAF}
            fill="none"
            stroke={POWDER}
            strokeWidth={2}
            strokeDasharray="0.1 7"
            strokeLinecap="round"
          />
          <path d="M0 -78 V -150" stroke="#7FE0B0" strokeWidth={1.6} />
        </g>
      ))}
      {petals.map((petal, index) => {
        const angle = index * step;
        const [x, y] = polar(angle, 232);
        const [lx, ly] = polar(angle, 286);
        const anchor = Math.abs(lx) < 20 ? 'middle' : lx > 0 ? 'start' : 'end';
        return (
          <g key={petal.key} className="bloom">
            <g transform={`rotate(${String(angle)})`}>
              <path className="petal" d={PETAL} fill={`url(#${id}-p${String(index)})`} />
              <path
                d={PETAL}
                fill="none"
                stroke={POWDER}
                strokeWidth={2.6}
                strokeDasharray="0.1 8"
                strokeLinecap="round"
                opacity={0.95}
              />
              <path d={PETAL_INNER} fill="none" stroke={POWDER} strokeWidth={1.3} opacity={0.55} />
            </g>
            <g transform={`translate(${String(round1(x))} ${String(round1(y + 14))}) scale(.9)`}>
              <DiyaShape lit={petal.value > 0} />
            </g>
            {showLabels && (
              <>
                <text
                  className="lbl"
                  x={round1(lx)}
                  y={round1(ly + (ly > 0 ? 18 : -4))}
                  textAnchor={anchor}
                >
                  {petal.label}
                </text>
                <text
                  className="pct"
                  x={round1(lx)}
                  y={round1(ly + (ly > 0 ? 34 : 12))}
                  textAnchor={anchor}
                >
                  {petal.caption}
                </text>
              </>
            )}
          </g>
        );
      })}
      {Array.from({ length: 16 }, (_, index) => (
        <path
          key={`lotus-${String(index)}`}
          d={LOTUS_OUTER}
          transform={`rotate(${String(index * 22.5)})`}
          fill={index % 2 ? '#F28C28' : '#F7B500'}
        />
      ))}
      {Array.from({ length: 8 }, (_, index) => (
        <path
          key={`bud-${String(index)}`}
          d={LOTUS_INNER}
          transform={`rotate(${String(index * 45 + 22.5)})`}
          fill="#E0457B"
        />
      ))}
      <circle r={16} fill="#2A1146" stroke="#F6D27A" strokeWidth={2} />
      <circle r={6} fill="#F6D27A" />
    </svg>
  );
}
