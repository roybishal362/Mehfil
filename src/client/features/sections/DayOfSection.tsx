/**
 * The run sheet for the big day (or days): every moment with its time, length and the person
 * in charge, plus Plan B for what might go wrong. It prints cleanly for the venue team.
 */
import { Plus, Printer, ShieldAlert, Trash2 } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import type { EventPlan, ScheduleItem } from '../../../shared/schemas/plan';
import { addDays, diffDays } from '../../../shared/utils/dates';
import { toast } from '../../app/feedback';
import { CommitInput } from '../../components/CommitInput';
import { Field } from '../../components/Field';
import { useI18n } from '../../i18n';
import { useEdit } from '../plan/use-edit';
import { SectionHead } from './SectionHead';

const LIKELIHOOD_PILL = { low: 'pill--ok', medium: 'pill--warn', high: 'pill--danger' } as const;
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

function byDay(items: readonly ScheduleItem[]): [string, ScheduleItem[]][] {
  const days = new Map<string, ScheduleItem[]>();
  for (const item of [...items].sort(
    (a, b) => a.day.localeCompare(b.day) || a.time.localeCompare(b.time),
  )) {
    days.set(item.day, [...(days.get(item.day) ?? []), item]);
  }
  return [...days.entries()];
}

export function DayOfSection({ plan }: { plan: EventPlan }) {
  const { t, f } = useI18n();
  const edit = useEdit(plan.id);
  const first = addDays(plan.brief.date, -1);
  const last = plan.brief.endDate ?? plan.brief.date;
  const [day, setDay] = useState(plan.brief.date);
  const [time, setTime] = useState('');
  const [minutes, setMinutes] = useState('60');
  const [title, setTitle] = useState('');
  const [owner, setOwner] = useState('');

  const addItem = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const durationMinutes = Number(minutes);
    if (
      !title.trim() ||
      !CLOCK.test(time) ||
      !Number.isInteger(durationMinutes) ||
      durationMinutes < 0 ||
      durationMinutes > 720
    ) {
      toast(t.dayOfSection.addInvalid, { tone: 'error' });
      return;
    }
    const item = {
      day,
      time,
      durationMinutes,
      title: title.trim(),
      ...(owner.trim() ? { owner: owner.trim() } : {}),
    };
    if (edit({ type: 'schedule.add', item })) {
      setTitle('');
      setTime('');
      setOwner('');
    }
  };

  const dayName = (iso: string) => {
    const offset = diffDays(iso, plan.brief.date);
    if (offset === -1) return `${t.dayOfSection.dayBefore} · ${f.dateLong(iso)}`;
    return f.dateLong(iso);
  };

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
              <li key={item.id} className="slot">
                <input
                  type="time"
                  className="input input--inline slot-time"
                  aria-label={t.dayOfSection.timeOf(item.title)}
                  value={item.time}
                  onChange={(event) => {
                    if (CLOCK.test(event.target.value)) {
                      edit({
                        type: 'schedule.update',
                        id: item.id,
                        patch: { time: event.target.value },
                      });
                    }
                  }}
                />
                <div className="slot-body">
                  <CommitInput
                    value={item.title}
                    label={t.dayOfSection.whatAt(f.time(item.time))}
                    maxLength={100}
                    onCommit={(value) =>
                      edit({ type: 'schedule.update', id: item.id, patch: { title: value } })
                    }
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
                      onCommit={(value) =>
                        edit({
                          type: 'schedule.update',
                          id: item.id,
                          patch: { owner: value || undefined },
                        })
                      }
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
            ))}
          </ol>
        </div>
      ))}

      <form className="card add-row" onSubmit={addItem}>
        <h3 className="add-title">{t.dayOfSection.add}</h3>
        <Field id="slot-day" label={t.dayOfSection.day}>
          {(control) => (
            <input
              {...control}
              type="date"
              className="input"
              min={first}
              max={last}
              value={day}
              onChange={(event) => {
                setDay(event.target.value);
              }}
            />
          )}
        </Field>
        <Field id="slot-time" label={t.dayOfSection.time}>
          {(control) => (
            <input
              {...control}
              type="time"
              className="input"
              value={time}
              onChange={(event) => {
                setTime(event.target.value);
              }}
            />
          )}
        </Field>
        <Field id="slot-minutes" label={t.dayOfSection.duration}>
          {(control) => (
            <input
              {...control}
              type="number"
              className="input"
              min={0}
              max={720}
              step={15}
              value={minutes}
              onChange={(event) => {
                setMinutes(event.target.value);
              }}
            />
          )}
        </Field>
        <Field id="slot-title" label={t.dayOfSection.itemTitle}>
          {(control) => (
            <input
              {...control}
              className="input"
              maxLength={100}
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
              }}
            />
          )}
        </Field>
        <Field id="slot-owner" label={t.dayOfSection.owner} extra={`(${t.common.optional})`}>
          {(control) => (
            <input
              {...control}
              className="input"
              maxLength={60}
              value={owner}
              onChange={(event) => {
                setOwner(event.target.value);
              }}
            />
          )}
        </Field>
        <button type="submit" className="btn btn--gold btn--sm">
          <Plus />
          {t.dayOfSection.addButton}
        </button>
      </form>

      {plan.risks.length > 0 && (
        <div className="card">
          <header className="card-head">
            <span className="badge">
              <ShieldAlert />
            </span>
            <h3>{t.dayOfSection.planB}</h3>
          </header>
          <ul className="tasks" lang={plan.brief.language}>
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
      )}
    </section>
  );
}
