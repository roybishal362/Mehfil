/**
 * Entry point. Fonts are self-hosted (no third-party requests) and split by script, so Hindi
 * and Bengali glyphs download only when they appear on the page. Eczar (display) and Mukta
 * (text) cover Latin and Devanagari; Tiro Bangla and Noto Sans Bengali cover Bengali.
 */
import '@fontsource-variable/eczar/wght.css';
import '@fontsource/mukta/400.css';
import '@fontsource/mukta/500.css';
import '@fontsource/mukta/600.css';
import '@fontsource/mukta/700.css';
import '@fontsource/tiro-bangla/bengali-400.css';
import '@fontsource-variable/noto-sans-bengali/wght.css';
import './styles/fonts.css';
import './styles/index.css';
import { startTransition, StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { App } from './App';
import { toast } from './app/feedback';
import { loadRuntimeConfig } from './app/runtime-config';
import { connectCloud } from './cloud/account';
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
  // Firebase loads only when a cloud feature is used (or a Google user returns).
  connectCloud({ store: plansStore, storage });

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
