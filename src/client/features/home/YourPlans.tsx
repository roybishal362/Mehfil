/**
 * The celebrations saved on this device. Each tile carries its occasion's colour and picture,
 * the countdown, and a diya for every part of the plan that has begun.
 */
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'wouter';
import type { Mood } from '../../../shared/domain/mood';
import type { EventPlan } from '../../../shared/schemas/plan';
import { localToday } from '../../../shared/utils/dates';
import { toast } from '../../app/feedback';
import { paths } from '../../app/routing';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useI18n } from '../../i18n';
import { DiyaRow } from '../../motifs/Diya';
import { OccasionArt, type OccasionKind } from '../../motifs/OccasionArt';
import { cancelPersonalization } from '../../state/ai';
import { plansStore, usePlans } from '../../state/plans';
import { countdownParts, partsSummary, planView } from '../plan/present';

const MOOD_ART: Readonly<Record<Mood, OccasionKind>> = {
  neutral: 'other',
  wedding: 'wedding',
  birthday: 'birthday',
  durga: 'durga',
  ganpati: 'ganpati',
  diwali: 'diwali',
  utsav: 'community',
};

function PlanTile({ plan, onDelete }: { plan: EventPlan; onDelete: (plan: EventPlan) => void }) {
  const { t, f } = useI18n();
  const view = planView(plan, localToday(), t, f);
  const seal = countdownParts(view.countdown, t, f);
  const ready = t.home.ready(f.percent(view.score / 100));
  return (
    <li className="plan-tile" data-mood={view.mood}>
      <span className="tile-pic">
        <OccasionArt kind={MOOD_ART[view.mood]} />
      </span>
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
        <DiyaRow
          parts={view.parts}
          label={`${ready}. ${t.plan.progressSummary(partsSummary(view.parts, t))}`}
        />
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
