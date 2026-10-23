/** The plan overview: the summary, today's focus and the state of every part of the plan. */
import type { EventPlan } from '../../../shared/schemas/plan';
import { useI18n } from '../../i18n';
import { BudgetCard } from './BudgetCard';
import { FocusCard } from './FocusCard';
import { JourneyCard } from './JourneyCard';
import { RisksCard, SummaryCard, ThemeCard, VendorsCard } from './SmallCards';

export function Overview({ plan }: { plan: EventPlan }) {
  const { t } = useI18n();
  return (
    <section aria-labelledby="section-title">
      <h2 id="section-title" className="sr-only" data-route-focus="section" tabIndex={-1}>
        {t.overview.title}
      </h2>
      <div className="grid-2">
        <SummaryCard plan={plan} />
        <FocusCard plan={plan} />
        <BudgetCard plan={plan} />
        <JourneyCard plan={plan} />
        <VendorsCard plan={plan} />
        <ThemeCard plan={plan} />
        <RisksCard plan={plan} />
      </div>
    </section>
  );
}
