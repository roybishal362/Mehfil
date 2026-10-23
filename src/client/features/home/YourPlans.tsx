/** The celebrations saved on this device, each as a small maroon invitation tile. */
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'wouter';
import type { EventPlan } from '../../../shared/schemas/plan';
import { localToday } from '../../../shared/utils/dates';
import { toast } from '../../app/feedback';
import { paths } from '../../app/routing';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useI18n } from '../../i18n';
import { Divider } from '../../motifs/Ornaments';
import { Rangoli } from '../../motifs/Rangoli';
import { cancelPersonalization } from '../../state/ai';
import { plansStore, usePlans } from '../../state/plans';
import { countdownParts, planView } from '../plan/present';

function PlanTile({ plan, onDelete }: { plan: EventPlan; onDelete: (plan: EventPlan) => void }) {
  const { t, f } = useI18n();
  const view = planView(plan, localToday(), t, f);
  const seal = countdownParts(view.countdown, t, f);
  const when = view.countdown.kind === 'upcoming' ? `${seal.big} ${seal.small}` : seal.big;
  return (
    <li className="plan-tile">
      <Rangoli petals={view.petals} className="mini" />
      <div>
        <h3>
          <Link className="tile-link" href={paths.plan(plan.id)}>
            {plan.brief.title}
          </Link>
        </h3>
        <p className="meta">
          <span>{f.date(plan.brief.date)}</span>
          <span>{plan.brief.city}</span>
        </p>
        <p className="meta">
          <span>{when}</span>
          <span>{t.home.ready(f.percent(view.score / 100))}</span>
        </p>
      </div>
      <div className="tile-actions">
        <button
          type="button"
          className="btn btn--quiet"
          onClick={() => {
            onDelete(plan);
          }}
        >
          <Trash2 />
          {t.home.removePlan}
          <span className="sr-only">: {plan.brief.title}</span>
        </button>
      </div>
    </li>
  );
}

export function YourPlans() {
  const { t } = useI18n();
  const order = usePlans((state) => state.order);
  const plans = usePlans((state) => state.plans);
  const [pending, setPending] = useState<EventPlan | null>(null);
  const list = order.map((id) => plans[id]).filter((plan) => plan !== undefined);
  if (list.length === 0) return null;

  const remove = (plan: EventPlan) => {
    setPending(null);
    cancelPersonalization(plan.id);
    plansStore.getState().removePlan(plan.id);
    toast(t.home.removed(plan.brief.title), {
      action: {
        label: t.common.undo,
        run: () => {
          plansStore.getState().restorePlan(plan);
        },
      },
    });
  };

  return (
    <section className="band" aria-labelledby="yours-title">
      <div className="wrap">
        <Divider />
        <div className="sec-title">
          <h2 id="yours-title">{t.home.yoursTitle}</h2>
          <p>{t.home.yoursText}</p>
        </div>
        <ul className="plans-list">
          {list.map((plan) => (
            <PlanTile key={plan.id} plan={plan} onDelete={setPending} />
          ))}
        </ul>
      </div>
      <ConfirmDialog
        open={pending !== null}
        title={pending ? t.home.removeConfirmTitle(pending.brief.title) : ''}
        body={t.home.removeConfirmText}
        confirmLabel={t.home.removePlan}
        cancelLabel={t.common.cancel}
        danger
        onConfirm={() => {
          if (pending) remove(pending);
        }}
        onCancel={() => {
          setPending(null);
        }}
      />
    </section>
  );
}
