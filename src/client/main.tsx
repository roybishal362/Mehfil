/**
 * Entry point. Fonts are self-hosted (no third-party requests) and split by script, so Hindi
 * and Bengali glyphs download only when they appear on the page.
 */
import '@fontsource-variable/inter/wght.css';
import '@fontsource-variable/cormorant-garamond/wght.css';
import '@fontsource-variable/cormorant-garamond/wght-italic.css';
import '@fontsource/great-vibes/latin-400.css';
import '@fontsource/tiro-devanagari-hindi/devanagari-400.css';
import '@fontsource/tiro-bangla/bengali-400.css';
import '@fontsource-variable/noto-sans-devanagari/wght.css';
import '@fontsource-variable/noto-sans-bengali/wght.css';
import './styles/index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
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

  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void start();
