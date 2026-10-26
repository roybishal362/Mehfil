/** Routes. The home page ships in the main bundle; heavier pages load on demand. */
import { LucideProvider } from 'lucide-react';
import { lazy, Suspense, useLayoutEffect } from 'react';
import { Link, Route, Router, Switch } from 'wouter';
import { paths, useDocumentTitle } from './app/routing';
import { Shell } from './app/Shell';
import { aroundNav } from './app/view-transition';
import { useI18n } from './i18n';
import { HomePage } from './pages/HomePage';

const NewPlanPage = lazy(() =>
  import('./pages/NewPlanPage').then((module) => ({ default: module.NewPlanPage })),
);
const PlanPage = lazy(() =>
  import('./pages/PlanPage').then((module) => ({ default: module.PlanPage })),
);
const SharedPlanPage = lazy(() =>
  import('./pages/SharedPlanPage').then((module) => ({ default: module.SharedPlanPage })),
);

function PageLoading() {
  const { t } = useI18n();
  return (
    <div className="wrap">
      <p className="empty" role="status">
        <span className="spinner" aria-hidden="true" />
        {t.common.loading}
      </p>
    </div>
  );
}

function NotFoundPage() {
  const { t } = useI18n();
  useDocumentTitle(t.plan.notFoundTitle);
  return (
    <div className="wrap">
      <div className="empty mt-16">
        <h1 data-route-focus="page" tabIndex={-1} className="text-4xl">
          {t.plan.notFoundTitle}
        </h1>
        <Link className="btn btn--primary mt-4" href={paths.home}>
          {t.plan.backHome}
        </Link>
      </div>
    </div>
  );
}

export interface AppProps {
  /** Set only when prerendering at build time (there is no browser location then). */
  ssrPath?: string;
}

export function App({ ssrPath }: AppProps) {
  // The build-time snapshot may have been hidden (another page or language); the live app
  // has now replaced it.
  useLayoutEffect(() => {
    delete document.documentElement.dataset.prerender;
  }, []);
  return (
    <LucideProvider strokeWidth={1.75} className="i">
      <Router aroundNav={aroundNav} {...(ssrPath ? { ssrPath } : {})}>
        <Shell>
          <Suspense fallback={<PageLoading />}>
            <Switch>
              <Route path="/" component={HomePage} />
              <Route path="/new" component={NewPlanPage} />
              <Route path="/plan/:id/:section?" component={PlanPage} />
              <Route path="/s/:id" component={SharedPlanPage} />
              <Route component={NotFoundPage} />
            </Switch>
          </Suspense>
        </Shell>
      </Router>
    </LucideProvider>
  );
}
