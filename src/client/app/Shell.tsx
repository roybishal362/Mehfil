/** The page frame: skip link, festive header, main landmark, footer and notifications. */
import { Moon, Sun } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { APP_NAME } from '../../shared/meta';
import { LOCALES, LOCALE_NAMES, useI18n, useLocaleStore } from '../i18n';
import { BrandMark } from '../motifs/Diya';
import { Stars, StringLights } from '../motifs/NightSky';
import { Feedback } from './feedback';
import { paths, useRouteFocus } from './routing';
import { useRuntimeConfig } from './runtime-config';
import { useTheme } from './theme';

function LanguageSwitch() {
  const { t, locale } = useI18n();
  const setLocale = useLocaleStore((state) => state.setLocale);
  return (
    <div className="langs" role="group" aria-label={t.shell.language}>
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          lang={code}
          aria-pressed={locale === code}
          title={LOCALE_NAMES[code].name}
          onClick={() => {
            void setLocale(code);
          }}
        >
          <span aria-hidden="true">{LOCALE_NAMES[code].short}</span>
          <span className="sr-only">{LOCALE_NAMES[code].name}</span>
        </button>
      ))}
    </div>
  );
}

function ThemeToggle() {
  const { t } = useI18n();
  const theme = useTheme((state) => state.theme);
  const toggle = useTheme((state) => state.toggle);
  const label = theme === 'night' ? t.shell.toDay : t.shell.toNight;
  return (
    <button type="button" className="roundbtn" aria-label={label} title={label} onClick={toggle}>
      {theme === 'night' ? <Sun /> : <Moon />}
    </button>
  );
}

function SiteHeader({ overlay }: { overlay: boolean }) {
  const { t } = useI18n();
  const [location] = useLocation();
  const current = (path: string) => (location === path ? ('page' as const) : undefined);
  return (
    <header className={overlay ? 'top top--overlay' : 'top'}>
      <Link href={paths.home} className="brand" aria-label={t.shell.home}>
        <BrandMark />
        <span className="brand-word foil" aria-hidden="true">
          {APP_NAME}
        </span>
      </Link>
      <nav className="nav" aria-label={t.shell.navLabel}>
        <Link href={paths.home} aria-current={current(paths.home)}>
          {t.shell.nav.celebrations}
        </Link>
        <Link href={paths.newPlan()} aria-current={current(paths.newPlan())}>
          {t.shell.nav.newPlan}
        </Link>
      </nav>
      <div className="tools">
        <LanguageSwitch />
        <ThemeToggle />
      </div>
    </header>
  );
}

function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer className="site-footer">
      <div className="wrap">
        <p>{t.shell.footerNote}</p>
        <p>{t.shell.footerMade}</p>
      </div>
    </footer>
  );
}

function DemoBanner() {
  const { t } = useI18n();
  const mode = useRuntimeConfig((state) => state.config?.ai.mode);
  if (mode !== 'mock') return null;
  return (
    <aside className="demo-banner" aria-label={t.shell.demoLabel}>
      {t.shell.demo}
    </aside>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [location] = useLocation();
  useRouteFocus();
  const home = location === paths.home;
  return (
    <>
      <a className="skip-link" href="#main">
        {t.shell.skip}
      </a>
      <DemoBanner />
      {/* On the home page the header floats over the hero's night sky. */}
      <div className="frame">
        {home ? (
          <SiteHeader overlay />
        ) : (
          <div className="sky-strip">
            <Stars />
            <StringLights />
            <SiteHeader overlay={false} />
          </div>
        )}
        <main id="main" tabIndex={-1}>
          {children}
        </main>
      </div>
      <SiteFooter />
      <Feedback />
    </>
  );
}
