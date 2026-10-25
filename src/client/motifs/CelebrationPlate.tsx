/**
 * The home page's centrepiece: a brass-rimmed plate whose scene changes every few seconds,
 * from a wedding kalash to the Durga Puja dhak, Ganpati's modaks, a birthday cake and Diwali's
 * lamps. It runs on CSS alone (motifs.css): it starts once the page has loaded, and holds still
 * on the first scene for reduced motion.
 */
import { useI18n } from '../i18n';
import { Balloons, Cake, Dhak, Kalash, Kandils, ModakStack, ShiuliRain, Sunburst } from './festive';

function ring(radius: number, count: number): [number, number][] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (2 * Math.PI * index) / count;
    return [
      Math.round(Math.cos(angle) * radius * 100) / 100,
      Math.round(Math.sin(angle) * radius * 100) / 100,
    ];
  });
}

const OUTER_DOTS = ring(96, 72);
const INNER_DOTS = ring(90, 36);
const SIDE_MARIGOLDS = [
  { x: 2, y: 92, gold: false },
  { x: 16, y: 102, gold: true },
  { x: 90, y: 102, gold: true },
  { x: 104, y: 92, gold: false },
];

export function CelebrationPlate() {
  const { t } = useI18n();
  return (
    <div className="plate" role="img" aria-label={t.home.plateLabel}>
      <div className="plate-rim" aria-hidden="true" />
      <svg className="plate-dots motion" viewBox="-100 -100 200 200" aria-hidden="true">
        {OUTER_DOTS.map(([x, y]) => (
          <circle key={`o${String(x)}${String(y)}`} cx={x} cy={y} r="1.2" className="dot-a" />
        ))}
        {INNER_DOTS.map(([x, y]) => (
          <circle key={`i${String(x)}${String(y)}`} cx={x} cy={y} r="1.8" className="dot-b" />
        ))}
      </svg>
      <div className="vignettes" aria-hidden="true">
        <div className="vignette vignette--wedding motion">
          <svg viewBox="0 0 120 120" focusable="false">
            <Kalash />
            {SIDE_MARIGOLDS.map(({ x, y, gold }) => (
              <use
                key={x}
                href={gold ? '#m-marigold-gold' : '#m-marigold'}
                x={x}
                y={y}
                width="18"
                height="18"
              />
            ))}
          </svg>
        </div>
        <div className="vignette vignette--durga motion">
          <ShiuliRain count={6} />
          <Dhak />
        </div>
        <div className="vignette vignette--ganpati motion">
          <Sunburst />
          <ModakStack />
        </div>
        <div className="vignette vignette--birthday motion">
          <Balloons />
          <svg viewBox="20 36 80 72" focusable="false">
            <Cake />
          </svg>
        </div>
        <div className="vignette vignette--diwali motion">
          <Kandils />
          <svg className="plate-diya" viewBox="0 2 40 36" focusable="false">
            <use href="#m-diya" width="40" height="40" />
          </svg>
        </div>
      </div>
      <div className="plate-caption" aria-hidden="true">
        {t.home.plateScenes.map((scene) => (
          <span key={scene} className="plate-scene motion">
            {scene}
          </span>
        ))}
      </div>
    </div>
  );
}
