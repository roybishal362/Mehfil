/**
 * The home page's centrepiece: a puja thali with a lit diya, and the things every celebration
 * brings floating around it (a lotus for Durga Puja, Ganpati's elephant, a ring, a cake, a
 * balloon, a gift, marigolds). Each drifts on its own; with a mouse, they shift with depth as
 * the pointer moves, like a little 3D scene. It holds still for reduced motion.
 */
import { useEffect, useRef, type RefObject } from 'react';
import type { ArtName } from '../art';
import { Art } from '../art/Art';
import { useI18n } from '../i18n';
import { motionAllowed } from '../lib/motion';

/** Each object's place, size and depth are set in motifs.css by its slot. */
const OBJECTS: readonly { name: ArtName; slot: string }[] = [
  { name: 'lotus', slot: 'lotus' },
  { name: 'ring', slot: 'ring' },
  { name: 'cake', slot: 'cake' },
  { name: 'marigold', slot: 'marigold-a' },
  { name: 'balloon', slot: 'balloon' },
  { name: 'elephant', slot: 'elephant' },
  { name: 'gift', slot: 'gift' },
  { name: 'marigold', slot: 'marigold-b' },
  { name: 'sparkles', slot: 'sparkles' },
  { name: 'diya', slot: 'diya' },
];

/** Moves the scene's layers with the pointer, by setting --px and --py (-1 to 1). */
function usePointerDepth(scene: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const element = scene.current;
    if (!element || !motionAllowed() || !window.matchMedia('(pointer: fine)').matches) return;
    const area = element.closest('section') ?? element;
    let frame = 0;
    const move = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = element.getBoundingClientRect();
        const x = (event.clientX - (box.left + box.width / 2)) / (box.width / 2);
        const y = (event.clientY - (box.top + box.height / 2)) / (box.height / 2);
        element.style.setProperty('--px', Math.max(-1, Math.min(1, x)).toFixed(3));
        element.style.setProperty('--py', Math.max(-1, Math.min(1, y)).toFixed(3));
      });
    };
    const leave = () => {
      cancelAnimationFrame(frame);
      element.style.setProperty('--px', '0');
      element.style.setProperty('--py', '0');
    };
    area.addEventListener('pointermove', move);
    area.addEventListener('pointerleave', leave);
    return () => {
      cancelAnimationFrame(frame);
      area.removeEventListener('pointermove', move);
      area.removeEventListener('pointerleave', leave);
    };
  }, [scene]);
}

export function CelebrationPlate() {
  const { t } = useI18n();
  const scene = useRef<HTMLDivElement>(null);
  usePointerDepth(scene);
  return (
    <div ref={scene} className="scene" role="img" aria-label={t.home.plateLabel}>
      <span className="scene-halo" />
      <span className="scene-thali" />
      {OBJECTS.map(({ name, slot }) => (
        <span key={slot} className={`scene-item scene-item--${slot}`}>
          <span className="scene-float motion">
            <Art name={name} size={slot === 'diya' ? 200 : 120} afterLoad />
          </span>
        </span>
      ))}
    </div>
  );
}
