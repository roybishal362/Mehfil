/**
 * The celebrations saved on this device. Each tile carries its occasion's colour and photograph,
 * the countdown, and how many parts of the plan have begun.
 */
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'wouter';
import type { EventPlan } from '../../../shared/schemas/plan';
import { localToday } from '../../../shared/utils/dates';
import { toast } from '../../app/feedback';
import { paths } from '../../app/routing';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useI18n } from '../../i18n';
import { archPhoto } from '../../photos';
import { Arch } from '../../photos/Arch';
import { Photo } from '../../photos/Photo';
import { cancelPersonalization } from '../../state/ai';
import { plansStore, usePlans } from '../../state/plans';
import { countdownParts, planView } from '../plan/present';
import { ProgressLine } from '../plan/ProgressLine';

function PlanTile({ plan, onDelete }: { plan: EventPlan; onDelete: (plan: EventPlan) => void }) {
  const { t, f } = useI18n();
  const view = planView(plan, localToday(), t, f);
  const seal = countdownParts(view.countdown, t, f);
  const ready = t.home.ready(f.percent(view.score / 100));
  return (
    <li className="plan-tile" data-mood={view.mood}>
      <Arch className="tile-pic">
        <Photo photo={archPhoto(view.mood)} sizes="56px" />
      </Arch>
      <div className="tile-body">
        <h3>
          <Link className="tile-link" href={paths.plan(plan.id)}>
            {plan.brief.title}
          </Link>
        </h3>
        <p className="meta">
          <span>{f.date(plan.brief.date)}</span>
          <span>{plan.brief.city}</span>
        </p>
        <ProgressLine parts={view.parts} status={ready} />
      </div>
      <p className={seal.word ? 'tile-count tile-count--word' : 'tile-count'}>
        <b>{seal.big}</b> <span>{seal.small}</span>
      </p>
      <button
        type="button"
        className="icon-btn tile-remove"
        title={t.home.removePlan}
        onClick={() => {
          onDelete(plan);
        }}
      >
        <Trash2 />
        <span className="sr-only">
          {t.home.removePlan}: {plan.brief.title}
        </span>
      </button>
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
        <div className="band-head">
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
