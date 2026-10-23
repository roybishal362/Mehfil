/**
 * The prerendered home page in index.html must pass the Content-Security-Policy and hydrate
 * cleanly, for first visits and for returning visitors whose saved state differs from it.
 */
import { act, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { useTheme } from './app/theme';
import { en } from './i18n/en';
import { renderPage } from './prerender';
import { seedPlan } from './test/helpers';

let root: Root | undefined;

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = undefined;
  document.body.replaceChildren();
});

/** Puts the build-time HTML on the page, then lets the app adopt it as main.tsx does. */
async function hydrate(html: string) {
  const container = document.createElement('div');
  container.id = 'root';
  container.innerHTML = html;
  document.body.append(container);
  const recoverableErrors: unknown[] = [];
  const consoleError = vi.spyOn(console, 'error');
  await act(async () => {
    root = hydrateRoot(
      container,
      <StrictMode>
        <App />
      </StrictMode>,
      { onRecoverableError: (error) => recoverableErrors.push(error) },
    );
    await Promise.resolve();
  });
  return { recoverableErrors, consoleErrors: consoleError.mock.calls };
}

describe('prerendered home page', () => {
  it('has no inline style attributes, which style-src would block', () => {
    const html = renderPage('/');
    expect(html).toContain('<h1');
    expect(html).not.toMatch(/\sstyle="/);
  });

  it('hydrates without mismatches on a first visit', async () => {
    const { recoverableErrors, consoleErrors } = await hydrate(renderPage('/'));
    expect(recoverableErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('hydrates for a returning visitor, then shows their plans and theme', async () => {
    const html = renderPage('/');
    const plan = seedPlan();
    document.documentElement.dataset.theme = 'day';
    useTheme.setState({ theme: 'day' });

    const { recoverableErrors, consoleErrors } = await hydrate(html);

    expect(recoverableErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(screen.getAllByText(plan.brief.title).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: en.shell.toNight })).toBeInTheDocument();
  });
});
