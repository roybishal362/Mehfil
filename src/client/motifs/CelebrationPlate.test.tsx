import { act, fireEvent, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { markLoaded } from '../lib/after-load';
import { renderAt } from '../test/helpers';
import { CelebrationPlate } from './CelebrationPlate';

beforeAll(() => {
  // As main.tsx does once the page has loaded: the scene's pictures then appear.
  markLoaded();
});

/** A browser that welcomes motion and has a mouse. */
function mouseAndMotion() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: query.includes('pointer: fine'), media: query })),
  );
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
}

function sceneIn(container: HTMLElement): HTMLElement {
  const scene = container.querySelector<HTMLElement>('.scene');
  if (!scene) throw new Error('no scene');
  // jsdom has no layout: give the scene a 400 px box at the origin.
  scene.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 400 }) as DOMRect;
  return scene;
}

describe('CelebrationPlate', () => {
  it('is one labelled picture made of decorative 3D objects', async () => {
    const { container } = renderAt(<CelebrationPlate />);
    expect(
      screen.getByRole('img', { name: /plans weddings, Durga Puja, Ganpati/ }),
    ).toBeInTheDocument();
    const images = container.querySelectorAll('img');
    expect(images.length).toBe(10);
    for (const image of images) expect(image).toHaveAttribute('alt', '');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shifts its layers with the pointer, and settles when it leaves', () => {
    mouseAndMotion();
    const { container } = renderAt(
      <section>
        <CelebrationPlate />
      </section>,
    );
    const scene = sceneIn(container);
    const section = container.querySelector('section');
    if (!section) throw new Error('no section');
    act(() => {
      fireEvent.pointerMove(section, { clientX: 400, clientY: 100 });
    });
    expect(scene.style.getPropertyValue('--px')).toBe('1.000');
    expect(scene.style.getPropertyValue('--py')).toBe('-0.500');
    act(() => {
      fireEvent.pointerLeave(section);
    });
    expect(scene.style.getPropertyValue('--px')).toBe('0');
    expect(scene.style.getPropertyValue('--py')).toBe('0');
  });

  it('stays still without a mouse or for reduced motion', () => {
    const { container } = renderAt(
      <section>
        <CelebrationPlate />
      </section>,
    );
    const scene = sceneIn(container);
    const section = container.querySelector('section');
    if (!section) throw new Error('no section');
    fireEvent.pointerMove(section, { clientX: 400, clientY: 100 });
    expect(scene.style.getPropertyValue('--px')).toBe('');
  });
});
