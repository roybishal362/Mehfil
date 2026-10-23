import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { toHaveNoViolations } from 'jest-axe';
import { afterEach, beforeEach, expect, vi } from 'vitest';
import { resetAppState } from './helpers';

expect.extend(toHaveNoViolations);

// jsdom does not implement modal dialogs, scrolling or clipboard; give them minimal behaviour.
HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
  this.setAttribute('open', '');
};
HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
  if (!this.hasAttribute('open')) return;
  this.removeAttribute('open');
  this.dispatchEvent(new Event('close'));
};
window.scrollTo = () => undefined;
Element.prototype.scrollIntoView = () => undefined;

beforeEach(() => {
  resetAppState();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
