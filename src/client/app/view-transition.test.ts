import { afterEach, describe, expect, it, vi } from 'vitest';
import { aroundNav } from './view-transition';

function welcomeMotion(welcome: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: !welcome && query.includes('reduce'), media: query })),
  );
}

afterEach(() => {
  Reflect.deleteProperty(document, 'startViewTransition');
});

describe('aroundNav', () => {
  it('navigates straight away where view transitions are not available', () => {
    welcomeMotion(true);
    const navigate = vi.fn();
    aroundNav(navigate, '/new', { replace: false });
    expect(navigate).toHaveBeenCalledWith('/new', { replace: false });
  });

  it('navigates inside a view transition when motion is welcome', () => {
    welcomeMotion(true);
    const startViewTransition = vi.fn((update: () => void) => {
      update();
      return {};
    });
    Object.defineProperty(document, 'startViewTransition', {
      value: startViewTransition,
      configurable: true,
    });
    const navigate = vi.fn();
    aroundNav(navigate, '/plan/evt_1', undefined);
    expect(startViewTransition).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/plan/evt_1', undefined);
  });

  it('skips the transition for people who ask for reduced motion', () => {
    welcomeMotion(false);
    const startViewTransition = vi.fn();
    Object.defineProperty(document, 'startViewTransition', {
      value: startViewTransition,
      configurable: true,
    });
    const navigate = vi.fn();
    aroundNav(navigate, '/', undefined);
    expect(startViewTransition).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/', undefined);
  });
});
