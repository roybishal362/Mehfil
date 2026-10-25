/**
 * The art for each celebration moment, drawn in the same flat, papercut style as the plan
 * headers. Everything here is decorative; Moment.tsx hides it from assistive technology.
 * Motion is CSS (moments.css), except the Diwali rockets and birthday confetti (show.ts).
 */
import { useEffect, useRef } from 'react';
import { Garland, ModakStack, Sunburst } from '../../motifs/festive';
import { startShow, type ShowKind } from './show';

const SKIN = '#c68a5c';

/** The bride and groom, joined by the gathbandhan knot, as they walk round the fire. */
function Couple() {
  return (
    <svg className="couple" viewBox="0 0 150 172" focusable="false">
      {/* Groom: an ivory sherwani, a red stole, a saffron safa and a sehra of flowers. */}
      <path d="M39 132h6v32h-6zM47 132h6v32h-6z" fill="#efe2c8" />
      <path d="M36 162h10v5H34zM46 162h10l2 5H46z" fill="#c9a35a" />
      <path d="M31 60 25 104l6 2 6-40ZM61 60l6 44-6 2-6-40Z" fill="#e6cf9e" />
      <circle cx="28" cy="107" r="3.2" fill={SKIN} />
      <circle cx="64" cy="107" r="3.2" fill={SKIN} />
      <path d="M31 58Q46 50 61 58L65 134Q46 140 27 134Z" fill="#f1dfb8" />
      <path
        d="M46 60V132"
        stroke="#c9a35a"
        strokeWidth="1.6"
        strokeDasharray="1.5 5"
        strokeLinecap="round"
      />
      <path d="M33 58 60 108 55 112 29 64Z" fill="#b3241c" />
      <rect x="42" y="46" width="8" height="9" fill="#b47a52" />
      <circle cx="46" cy="36" r="11" fill={SKIN} />
      <path d="M34 35C32 17 60 17 58 35 52 29 40 29 34 35Z" fill="#e27b2b" />
      <path d="M35 31C41 26 51 26 57 31" stroke="#b3241c" strokeWidth="2" fill="none" />
      <path d="M46 21C44 13 48 8 50 3 51 11 49 16 46 21Z" fill="#e6ad12" />
      <circle cx="46" cy="23" r="2.4" fill="#fff5d6" />
      <path
        d="M38 34v13M42 34v15M46 34v16M50 34v15M54 34v13"
        stroke="#fff5e0"
        strokeWidth="1.6"
        strokeDasharray="1.6 2.6"
        strokeLinecap="round"
      />
      {/* Bride: a red lehenga with a gold border, and a red chunri over her head. */}
      <path d="M92 94h24l20 72H72Z" fill="#b3241c" />
      <path d="M75 155h58l3 11H72Z" fill="#e6ad12" />
      <path d="M80 132h48" stroke="#e6ad12" strokeWidth="2.4" strokeDasharray="2 6" />
      <path d="M93 66 86 104l5 2 7-36ZM115 66l7 38-5 2-7-36Z" fill={SKIN} />
      <path d="M86 97l6 1M86 100l6 1M116 98l6-1M116 101l6-1" stroke="#e6ad12" strokeWidth="1.6" />
      <path d="M93 64h22l3 30H90Z" fill="#c9302f" />
      <rect x="100" y="52" width="8" height="10" fill="#b47a52" />
      <circle cx="104" cy="44" r="10.5" fill={SKIN} />
      <path
        d="M90 46C88 25 120 25 118 46L124 102C116 97 110 97 104 99 98 97 92 97 84 102ZM97.5 45a6.5 8.5 0 1 0 13 0 6.5 8.5 0 1 0-13 0Z"
        fill="#d13a2f"
        fillRule="evenodd"
        opacity=".95"
      />
      <path
        d="M84 102 90 46C88 25 120 25 118 46L124 102"
        stroke="#e6ad12"
        strokeWidth="2.2"
        fill="none"
      />
      <circle cx="104" cy="36" r="1.8" fill="#fff5d6" />
      {/* The gathbandhan: his stole tied to her chunri. */}
      <path d="M58 110C70 126 80 124 86 104" stroke="#f0c14b" strokeWidth="3" fill="none" />
      <circle cx="71" cy="121" r="3.2" fill="#f0c14b" />
    </svg>
  );
}

/** The havan kund: a brick fire altar with dancing flames. */
function HavanKund() {
  return (
    <svg className="havan" viewBox="0 0 120 132" focusable="false">
      <g className="havan-flames">
        <path
          className="fl"
          d="M60 4C78 30 88 50 81 72 76 86 44 86 39 72 32 50 44 28 60 4Z"
          fill="#ef8f1c"
        />
        <path
          className="fl fl--side"
          d="M44 76C30 66 29 50 35 38 38 52 45 62 52 74Z"
          fill="#ef8f1c"
        />
        <path
          className="fl fl--side"
          d="M76 76C90 66 91 50 85 38 82 52 75 62 68 74Z"
          fill="#ef8f1c"
        />
        <path
          className="fl fl--mid"
          d="M60 24C71 42 77 56 73 70 70 80 50 80 47 70 43 56 49 42 60 24Z"
          fill="#f7c948"
        />
        <path
          className="fl fl--core"
          d="M60 46C66 56 68 64 66 72 64 78 56 78 54 72 52 64 54 56 60 46Z"
          fill="#fff2c2"
        />
      </g>
      <path d="M34 84 86 78M36 78l50 6" stroke="#5a2e14" strokeWidth="4" strokeLinecap="round" />
      <path d="M18 80h84l-7 13H25Z" fill="#c25a2c" />
      <path d="M25 93h70l-5 20H30Z" fill="#a8532a" />
      <path d="M14 113h92v11H14Z" fill="#8a3f1f" />
      <g fill="#f3e7d3">
        <circle cx="40" cy="103" r="2" />
        <circle cx="60" cy="103" r="2" />
        <circle cx="80" cy="103" r="2" />
      </g>
    </svg>
  );
}

const EMBERS = 6;

export function WeddingScene() {
  return (
    <>
      <Garland className="moment-garland" />
      <div className="phera">
        <div className="phera-glow" />
        <div className="phera-z">
          <div className="phera-x">
            <div className="phera-y">
              <Couple />
            </div>
          </div>
        </div>
        <div className="phera-fire">
          <HavanKund />
          {Array.from({ length: EMBERS }, (_, index) => (
            <span key={index} className="ember" />
          ))}
        </div>
      </div>
      <Petals kind="wedding" />
    </>
  );
}

/** A dhaki, the Durga Puja drummer, with the dhak slung in front and its plume of kash. */
function Dhaki() {
  return (
    <svg className="dhaki" viewBox="0 0 220 270" focusable="false">
      <path d="M86 176h48l6 88h-24l-6-56-6 56H80Z" fill="#f6f0e4" />
      <path d="M80 258h24M116 258h24" stroke="#c42a2a" strokeWidth="5" />
      <path d="M82 96Q110 84 138 96L144 180H76Z" fill="#fbf6ea" />
      <path d="M100 92Q110 102 120 92" stroke="#d8ccb6" strokeWidth="2" fill="none" />
      <path d="M76 164h68v12H76Z" fill="#c42a2a" />
      <path
        d="M86 164v12M98 164v12M110 164v12M122 164v12M134 164v12"
        stroke="#f6f0e4"
        strokeWidth="2"
      />
      <rect x="104" y="76" width="12" height="14" fill="#9a6440" />
      <circle cx="110" cy="62" r="18" fill="#a86f48" />
      <path d="M92 58C92 38 128 38 128 58 122 48 98 48 92 58Z" fill="#2b1d14" />
      <circle cx="110" cy="50" r="2.2" fill="#c42a2a" />
      <path d="M84 98 62 140l10 7 20-39Z" fill="#a86f48" />
      <path d="M66 144 46 162" stroke="#5a3a22" strokeWidth="4" strokeLinecap="round" />
      <g className="dhaki-drum">
        <g className="dhaki-plume">
          <path
            d="M78 146C74 124 62 104 46 86M80 146C78 122 72 98 62 76M82 146C82 120 80 96 78 72M84 146C86 122 90 100 94 80M76 146C68 128 56 114 40 104"
            stroke="#f3ead8"
            strokeWidth="5"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M78 146C74 124 62 104 46 86M80 146C78 122 72 98 62 76M82 146C82 120 80 96 78 72M84 146C86 122 90 100 94 80M76 146C68 128 56 114 40 104"
            stroke="#bfae92"
            strokeWidth="1"
            fill="none"
          />
        </g>
        <path
          d="M50 152C68 140 152 140 170 152V200C152 212 68 212 50 200Z"
          fill="#b8141f"
          stroke="#5e0a10"
          strokeWidth="3"
        />
        <ellipse
          cx="50"
          cy="176"
          rx="10"
          ry="24"
          fill="#f3e7d3"
          stroke="#7a1010"
          strokeWidth="2.5"
        />
        <ellipse
          cx="170"
          cy="176"
          rx="10"
          ry="24"
          fill="#f3e7d3"
          stroke="#7a1010"
          strokeWidth="2.5"
        />
        <path d="M68 146v66M90 143v72M130 143v72M152 146v66" stroke="#fffaf0" strokeWidth="3" />
        <path d="M58 154 162 198M58 198 162 154" stroke="#e8b04a" strokeWidth="2" />
      </g>
      <g className="dhaki-arm">
        <path d="M134 96l30 30-8 8-30-30Z" fill="#a86f48" />
        <path d="M160 132l24 20" stroke="#5a3a22" strokeWidth="4" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function DurgaScene() {
  return (
    <>
      <div className="curtain curtain--left" />
      <div className="curtain curtain--right" />
      <div className="dhaki-wrap">
        <div className="dhaki-body">
          <Dhaki />
          <span className="beat" />
          <span className="beat" />
          <span className="beat" />
        </div>
      </div>
      <Petals kind="shiuli" />
    </>
  );
}

/** Runs a canvas show for as long as the scene is on screen. */
function Show({ kind }: { kind: ShowKind }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    return element ? startShow(element, kind) : undefined;
  }, [kind]);
  return <canvas ref={canvas} className="moment-canvas" />;
}

const DIYAS = 9;

export function DiwaliScene() {
  return (
    <>
      <div className="stars" />
      <Show kind="fireworks" />
      <div className="diya-line">
        {Array.from({ length: DIYAS }, (_, index) => (
          <svg key={index} className="moment-diya" viewBox="0 2 40 36" focusable="false">
            <use href="#m-diya" width="40" height="40" />
          </svg>
        ))}
      </div>
    </>
  );
}

export function GanpatiScene() {
  return (
    <>
      <div className="moment-sun">
        <Sunburst />
      </div>
      <div className="moment-modaks">
        <ModakStack />
      </div>
      <Petals kind="marigold" />
    </>
  );
}

const BALLOONS = 9;

export function BirthdayScene() {
  return (
    <>
      <div className="rise-balloons">
        {Array.from({ length: BALLOONS }, (_, index) => (
          <svg key={index} className="rise-balloon" viewBox="0 0 60 150" focusable="false">
            <use href="#m-balloon" width="60" height="150" />
          </svg>
        ))}
      </div>
      <Show kind="confetti" />
    </>
  );
}

/** Points on a circle, for flowers set in a ring. */
function ring(radius: number, count: number): { x: number; y: number }[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (2 * Math.PI * index) / count;
    return {
      x: Math.round(Math.cos(angle) * radius * 10) / 10,
      y: Math.round(Math.sin(angle) * radius * 10) / 10,
    };
  });
}

const OUTER_RING = ring(80, 14);
const INNER_RING = ring(46, 8);

/** A ring of marigolds, as laid on the ground at a puja, turning slowly. */
function MarigoldRing() {
  return (
    <svg className="marigold-ring" viewBox="-100 -100 200 200" focusable="false">
      {OUTER_RING.map(({ x, y }, index) => (
        <use
          key={`o${String(index)}`}
          href={index % 2 ? '#m-marigold' : '#m-marigold-gold'}
          x={x - 13}
          y={y - 13}
          width="26"
          height="26"
        />
      ))}
      {INNER_RING.map(({ x, y }, index) => (
        <use
          key={`i${String(index)}`}
          href={index % 2 ? '#m-marigold-gold' : '#m-marigold'}
          x={x - 10}
          y={y - 10}
          width="20"
          height="20"
        />
      ))}
      <use href="#m-diya" x="-16" y="-18" width="32" height="32" />
    </svg>
  );
}

export function UtsavScene() {
  return (
    <>
      <Garland className="moment-garland" />
      <MarigoldRing />
      <Petals kind="marigold" />
    </>
  );
}

const PETALS = 21;

/** Flowers falling across the scene: rose and marigold, shiuli, or marigold alone. */
function Petals({ kind }: { kind: 'wedding' | 'shiuli' | 'marigold' }) {
  return (
    <div className="petals">
      {Array.from({ length: PETALS }, (_, index) => {
        if (kind === 'shiuli') {
          return (
            <svg key={index} className="petal" viewBox="-16 -16 32 34" focusable="false">
              <use href="#m-shiuli" x="-16" y="-16" width="32" height="34" />
            </svg>
          );
        }
        if (kind === 'wedding' && index % 3 !== 0) {
          return (
            <svg key={index} className="petal" viewBox="0 0 20 20" focusable="false">
              <path
                d="M10 1C16 5 18 12 10 19 2 12 4 5 10 1Z"
                fill={index % 2 ? '#d6336c' : '#f06595'}
              />
            </svg>
          );
        }
        return (
          <svg key={index} className="petal" viewBox="-16 -16 32 32" focusable="false">
            <use
              href={index % 2 ? '#m-marigold' : '#m-marigold-gold'}
              x="-16"
              y="-16"
              width="32"
              height="32"
            />
          </svg>
        );
      })}
    </div>
  );
}
