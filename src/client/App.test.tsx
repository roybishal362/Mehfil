import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { seedPlan } from './test/helpers';

function visit(path: string) {
  window.history.replaceState(null, '', path);
  return render(<App />);
}

describe('App', () => {
  it('opens on the festive home page with a skip link, navigation and no axe violations', async () => {
    const { container } = visit('/');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Light up every celebration',
    );
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main',
    );
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /Plan rangoli for a sample wedding/ }),
    ).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('switches the interface to Hindi and Bengali', async () => {
    const user = userEvent.setup();
    visit('/');
    await user.click(screen.getByRole('button', { name: 'हिन्दी' }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('हर उत्सव को');
    });
    expect(document.documentElement.lang).toBe('hi');
    await user.click(screen.getByRole('button', { name: 'বাংলা' }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('প্রতিটি উৎসবকে');
    });
    expect(screen.getByRole('button', { name: 'বাংলা' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('switches between the night and day themes', async () => {
    const user = userEvent.setup();
    visit('/');
    await user.click(screen.getByRole('button', { name: 'Switch to the day theme' }));
    expect(document.documentElement.dataset.theme).toBe('day');
    await user.click(screen.getByRole('button', { name: 'Switch to the night theme' }));
    expect(document.documentElement.dataset.theme).toBe('night');
  });

  it('loads the step-by-step form on demand', async () => {
    const user = userEvent.setup();
    visit('/');
    await user.click(screen.getByRole('link', { name: 'Step-by-step form' }));
    expect(
      await screen.findByRole(
        'heading',
        { level: 1, name: 'Plan a new celebration' },
        { timeout: 8000 },
      ),
    ).toBeInTheDocument();
  });

  it('opens a saved plan with its sections', async () => {
    const plan = seedPlan();
    visit(`/plan/${plan.id}`);
    expect(
      await screen.findByRole('heading', { level: 1, name: /Ananya/ }, { timeout: 8000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Plan sections' })).toBeInTheDocument();
  });

  it('shows a not-found page for unknown addresses', () => {
    visit('/somewhere');
    expect(
      screen.getByRole('heading', { level: 1, name: 'We could not find that plan' }),
    ).toBeInTheDocument();
  });

  it('lists saved celebrations on the home page', () => {
    seedPlan();
    visit('/');
    expect(
      screen.getByRole('heading', { level: 2, name: 'Your celebrations' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: "Ananya & Rohan's Wedding" })).toBeInTheDocument();
  });
});
