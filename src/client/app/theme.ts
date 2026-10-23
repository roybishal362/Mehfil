/**
 * Night (the Diwali sky, default) or Day (ivory and gold). The choice is applied to
 * <html data-theme> and remembered; public/theme-init.js applies it before first paint.
 */
import { create } from 'zustand';

export type Theme = 'night' | 'day';

const STORAGE_KEY = 'mehfil:theme';
const THEME_COLOR: Readonly<Record<Theme, string>> = { night: '#100a24', day: '#fbf4e7' };

function currentTheme(): Theme {
  // Build-time prerendering runs without a document; night is the default theme.
  if (typeof document === 'undefined') return 'night';
  return document.documentElement.dataset.theme === 'day' ? 'day' : 'night';
}

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage may be unavailable; the theme then lasts for this visit.
  }
}

interface ThemeState {
  theme: Theme;
  toggle: () => void;
}

export const useTheme = create<ThemeState>()((set, get) => ({
  // The initial state is what the prerendered page shows; hydration renders with it and React
  // then re-renders with the saved theme (see src/client/lib/hydration.ts).
  theme: 'night',
  toggle: () => {
    const theme: Theme = get().theme === 'night' ? 'day' : 'night';
    applyTheme(theme);
    set({ theme });
  },
}));
useTheme.setState({ theme: currentTheme() });
