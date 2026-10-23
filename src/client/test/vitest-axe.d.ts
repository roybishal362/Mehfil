import 'vitest';

interface AxeMatchers<R = unknown> {
  /** Asserts that an axe-core scan produced no accessibility violations. */
  toHaveNoViolations(): R;
}

declare module 'vitest' {
  // Declaration merging must repeat Vitest's own `T = any` default exactly.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-empty-object-type
  interface Assertion<T = any> extends AxeMatchers<T> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- declaration merging
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
