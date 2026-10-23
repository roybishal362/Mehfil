/**
 * Entry point. Fonts are self-hosted (no third-party requests) and split by script, so Hindi
 * and Bengali glyphs download only when they appear on the page.
 */
import './lib/zod-jitless';
import '@fontsource-variable/inter/wght.css';
import '@fontsource-variable/cormorant-garamond/wght.css';
import '@fontsource-variable/cormorant-garamond/wght-italic.css';
import '@fontsource/great-vibes/latin-400.css';
import '@fontsource/tiro-devanagari-hindi/devanagari-400.css';
import '@fontsource/tiro-bangla/bengali-400.css';
import '@fontsource-variable/noto-sans-devanagari/wght.css';
import '@fontsource-variable/noto-sans-bengali/wght.css';
import './styles/fonts.css';
import './styles/index.css';
import { startTransition, StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { App } from './App';
import { toast } from './app/feedback';
import { loadRuntimeConfig } from './app/runtime-config';
import { initLocale, useLocaleStore } from './i18n';
import { browserStorage, connectPersistence, loadPlans } from './state/persistence';
import { plansStore } from './state/plans';

async function start(): Promise<void> {
  const container = document.getElementById('root');
  if (!container) throw new Error('Root element #root is missing from index.html');

  await initLocale();
  const storage = browserStorage();
  plansStore.getState().hydrate(loadPlans(storage).plans);
  connectPersistence(plansStore, {
    storage,
    onSaveFailed: () => {
      toast(useLocaleStore.getState().messages.shell.saveFailed, { tone: 'error' });
    },
  });
  void loadRuntimeConfig();

  const app = (
    <StrictMode>
      <App />
    </StrictMode>
  );
  // index.html holds a prerendered English home page. React adopts it when it is on screen
  // (as a transition, so hydration yields to the browser instead of one long task);
  // public/theme-init.js hides it for other pages and languages, and React then replaces it.
  if (container.firstElementChild && document.documentElement.dataset.prerender === undefined) {
    startTransition(() => {
      hydrateRoot(container, app);
    });
  } else {
    createRoot(container).render(app);
  }
  startMotionWhenIdle();
}

/** Lets the looping decorations start once loading has finished (see base.css). */
function startMotionWhenIdle(): void {
  const start = () => {
    document.documentElement.dataset.motion = 'on';
  };
  const whenIdle = () => {
    if ('requestIdleCallback' in window) window.requestIdleCallback(start, { timeout: 2500 });
    else setTimeout(start, 1200);
  };
  if (document.readyState === 'complete') whenIdle();
  else window.addEventListener('load', whenIdle, { once: true });
}

void start();
