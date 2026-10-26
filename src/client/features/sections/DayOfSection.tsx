/**
 * The run sheet for the big day (or days): every moment with its time, length and the person
 * in charge, plus Plan B for what might go wrong. It prints cleanly for the venue team.
 */
import { Printer, ShieldAlert, Trash2 } from 'lucide-react';
import type { PlanOperationInput } from '../../../shared/schemas/operations';
import type { EventPlan, ScheduleItem } from '../../../shared/schemas/plan';
import { diffDays, isClockTime } from '../../../shared/utils/dates';
import { CommitInput } from '../../components/CommitInput';
import { useI18n } from '../../i18n';
import { writtenIn } from '../../i18n/written-in';
import { useEdit, type Edit } from '../plan/use-edit';
import { AddSlotForm } from './AddSlotForm';
import { SectionHead } from './SectionHead';

const LIKELIHOOD_PILL = { low: 'pill--ok', medium: 'pill--warn', high: 'pill--danger' } as const;

type SlotPatch = Extract<PlanOperationInput, { type: 'schedule.update' }>['patch'];

/** The run sheet grouped by day, each day in time order. */
function byDay(items: readonly ScheduleItem[]): [string, ScheduleItem[]][] {
  const days = new Map<string, ScheduleItem[]>();
  const ordered = [...items].sort(
    (a, b) => a.day.localeCompare(b.day) || a.time.localeCompare(b.time),
  );
  for (const item of ordered) days.set(item.day, [...(days.get(item.day) ?? []), item]);
  return [...days.entries()];
}

function Slot({ item, edit }: { item: ScheduleItem; edit: Edit }) {
  const { t, f } = useI18n();
  const update = (patch: SlotPatch) => edit({ type: 'schedule.update', id: item.id, patch });
  return (
    <li className="slot">
      <input
        type="time"
        className="input input--inline slot-time"
        aria-label={t.dayOfSection.timeOf(item.title)}
        value={item.time}
        onChange={(event) => {
          if (isClockTime(event.target.value)) update({ time: event.target.value });
        }}
      />
      <div className="slot-body">
        <CommitInput
          value={item.title}
          label={t.dayOfSection.whatAt(f.time(item.time))}
          maxLength={100}
          onCommit={(value) => update({ title: value })}
        />
        <span className="slot-meta">
          {t.dayOfSection.minutes(f.number(item.durationMinutes))}
          <CommitInput
            value={item.owner ?? ''}
            label={t.dayOfSection.ownerOf(item.title)}
            placeholder={t.dayOfSection.ownerPlaceholder}
            maxLength={60}
            allowEmpty
            className="input input--inline input--owner"
            onCommit={(value) => update({ owner: value || undefined })}
          />
        </span>
      </div>
      <button
        type="button"
        className="icon-btn"
        aria-label={t.dayOfSection.remove(item.title)}
        onClick={() => edit({ type: 'schedule.remove', id: item.id })}
      >
        <Trash2 />
      </button>
    </li>
  );
}

/** What might go wrong, how likely it is, and what to do about it. */
function PlanB({ plan, edit }: { plan: EventPlan; edit: Edit }) {
  const { t } = useI18n();
  return (
    <div className="card">
      <header className="card-head">
        <span className="badge">
          <ShieldAlert />
        </span>
        <h3>{t.dayOfSection.planB}</h3>
      </header>
      <ul className="tasks" {...writtenIn(plan.brief.language)}>
        {plan.risks.map((risk) => (
          <li key={risk.id}>
            <div className="min-w-0 flex-1">
              <p className="t">{risk.title}</p>
              <p className="m">
                <span className={`pill ${LIKELIHOOD_PILL[risk.likelihood]}`}>
                  {t.overview.likelihood[risk.likelihood]}
                </span>
                <span>{risk.mitigation}</span>
              </p>
            </div>
            <button
              type="button"
              className="icon-btn"
              aria-label={t.dayOfSection.removeRisk(risk.title)}
              onClick={() => edit({ type: 'risk.remove', id: risk.id })}
            >
              <Trash2 />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DayOfSection({ plan }: { plan: EventPlan }) {
  const { t, f } = useI18n();
  const edit = useEdit(plan.id);
  // The eve of the event is labelled, since the run sheet may start the day before.
  const dayName = (iso: string) =>
    diffDays(iso, plan.brief.date) === -1
      ? `${t.dayOfSection.dayBefore} · ${f.dateLong(iso)}`
      : f.dateLong(iso);

  return (
    <section className="ws-main" aria-labelledby="section-title">
      <SectionHead title={t.dayOfSection.title} intro={t.dayOfSection.intro}>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => {
            window.print();
          }}
        >
          <Printer />
          {t.dayOfSection.print}
        </button>
      </SectionHead>

      {byDay(plan.schedule).map(([iso, items]) => (
        <div key={iso} className="card run-sheet">
          <h3 className="phase-title">{dayName(iso)}</h3>
          <ol className="slots">
            {items.map((item) => (
              <Slot key={item.id} item={item} edit={edit} />
            ))}
          </ol>
        </div>
      ))}

      <AddSlotForm plan={plan} edit={edit} />
      {plan.risks.length > 0 && <PlanB plan={plan} edit={edit} />}
    </section>
  );
}
