/**
 * Day (ivory paper and sindoor, the default) or Night (warm ink and brass). The choice is
 * applied to <html data-theme> and remembered; public/theme-init.js applies it before first
 * paint, following the device's light or dark setting until the visitor picks one.
 */
import { create } from 'zustand';

type Theme = 'night' | 'day';

const STORAGE_KEY = 'mehfil:theme';
const THEME_COLOR: Readonly<Record<Theme, string>> = { night: '#13100d', day: '#f6efe4' };

function currentTheme(): Theme {
  // Build-time prerendering runs without a document; day is the default theme.
  if (typeof document === 'undefined') return 'day';
  return document.documentElement.dataset.theme === 'night' ? 'night' : 'day';
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
  // The initial state is what the prerendered page shows. Zustand gives it to React as the
  // server snapshot, so hydration matches the page; React then re-renders with the saved theme.
  theme: 'day',
  toggle: () => {
    const theme: Theme = get().theme === 'night' ? 'day' : 'night';
    applyTheme(theme);
    set({ theme });
  },
}));
useTheme.setState({ theme: currentTheme() });
