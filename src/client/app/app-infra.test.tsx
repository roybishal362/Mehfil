import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useLocation } from 'wouter';
import { renderAt, jsonResponse, mockApi } from '../test/helpers';
import { Feedback, announce, toast, useFeedback } from './feedback';
import { isPlanSection, paths, useDocumentTitle, useRouteFocus } from './routing';
import { loadRuntimeConfig, useRuntimeConfig } from './runtime-config';
import { useTheme } from './theme';

describe('feedback', () => {
  it('shows toasts with an action, dismisses them and keeps at most three', async () => {
    const user = userEvent.setup();
    const undo = vi.fn();
    render(<Feedback />);
    act(() => {
      toast('Deleted “Mira turns 7”.', { action: { label: 'Undo', run: undo } });
    });
    expect(screen.getByRole('status')).toHaveTextContent('Deleted “Mira turns 7”.');
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(undo).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Deleted “Mira turns 7”.')).not.toBeInTheDocument();

    act(() => {
      for (const n of [1, 2, 3, 4]) toast(`Message ${String(n)}`);
      toast('Something failed', { tone: 'error' });
    });
    expect(useFeedback.getState().toasts).toHaveLength(3);
    expect(screen.getByRole('alert')).toHaveTextContent('Something failed');
    const [firstClose] = screen.getAllByRole('button', { name: 'Close' });
    if (!firstClose) throw new Error('no close button');
    await user.click(firstClose);
    expect(useFeedback.getState().toasts).toHaveLength(2);
  });

  it('dismisses toasts by themselves and announces background events', () => {
    vi.useFakeTimers();
    render(<Feedback />);
    act(() => {
      toast('Saved');
      announce('Budget is ready.');
    });
    expect(screen.getByText('Budget is ready.')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(6100);
    });
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });
});

describe('routing helpers', () => {
  it('builds paths and recognises sections', () => {
    expect(paths.plan('evt_1')).toBe('/plan/evt_1');
    expect(paths.plan('evt_1', 'day-of')).toBe('/plan/evt_1/day-of');
    expect(paths.newPlan('wedding')).toBe('/new?type=wedding');
    expect(paths.newPlan()).toBe('/new');
    expect(isPlanSection('budget')).toBe(true);
    expect(isPlanSection('settings')).toBe(false);
    expect(isPlanSection(undefined)).toBe(false);
  });

  it('titles the page and moves focus to new content after navigation', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame'] });
    function Page() {
      const [location, navigate] = useLocation();
      useRouteFocus();
      useDocumentTitle(location === '/' ? '' : 'Budget');
      return (
        <>
          <h1 tabIndex={-1} data-route-focus="page">
            Page
          </h1>
          <h2 tabIndex={-1} data-route-focus="section">
            Section
          </h2>
          <button
            type="button"
            onClick={() => {
              navigate('/plan/evt_1/budget');
            }}
          >
            budget
          </button>
          <button
            type="button"
            onClick={() => {
              navigate('/plan/evt_1/ideas');
            }}
          >
            ideas
          </button>
        </>
      );
    }
    renderAt(<Page />, '/');
    expect(document.title).toBe('Mehfil');
    act(() => {
      screen.getByRole('button', { name: 'budget' }).click();
    });
    act(() => {
      vi.runAllTimers();
    });
    expect(document.title).toBe('Budget · Mehfil');
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
    act(() => {
      screen.getByRole('button', { name: 'ideas' }).click();
    });
    act(() => {
      vi.runAllTimers();
    });
    expect(screen.getByRole('heading', { level: 2 })).toHaveFocus();
  });
});

describe('runtime config and theme', () => {
  it('loads the server config once and survives an unreachable server', async () => {
    mockApi({
      '/api/config': () =>
        jsonResponse({
          ai: { mode: 'mock', requiresSignIn: false },
          firebase: null,
          features: { cloudSync: false },
        }),
    });
    await loadRuntimeConfig();
    expect(useRuntimeConfig.getState().config?.ai.mode).toBe('mock');
  });

  it('toggles between night and day and remembers the choice', () => {
    useTheme.setState({ theme: 'night' });
    useTheme.getState().toggle();
    expect(document.documentElement.dataset.theme).toBe('day');
    expect(localStorage.getItem('mehfil:theme')).toBe('day');
    useTheme.getState().toggle();
    expect(document.documentElement.dataset.theme).toBe('night');
  });
});
