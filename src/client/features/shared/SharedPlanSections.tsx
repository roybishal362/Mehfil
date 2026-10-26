/**
 * The parts of a shared, read-only plan. Each shows only what the share snapshot carries
 * (src/shared/export/share.ts), which never includes guests' names or contacts.
 */
import type { Mood } from '../../../shared/domain/mood';
import type { SharedPlan } from '../../../shared/export/share';
import { useI18n } from '../../i18n';
import { writtenIn } from '../../i18n/written-in';
import { MoodArt } from '../../motifs/MoodArt';
import { archPhoto, HEADER_PHOTO_SIZES } from '../../photos';
import { Arch } from '../../photos/Arch';
import { Photo } from '../../photos/Photo';

const byKey =
  <T,>(key: (item: T) => string) =>
  (a: T, b: T) =>
    key(a).localeCompare(key(b));

/** The invitation-card header, in the occasion's look. */
export function SharedHeader({ plan, mood }: { plan: SharedPlan; mood: Mood }) {
  const { t, f } = useI18n();
  return (
    <header className="planhead planhead--shared" data-mood={mood}>
      <MoodArt mood={mood} />
      <div className="planhead-copy">
        <p className="greet">
          {t.moods.greeting[mood]}
          <span className="greet-sub">{t.shared.eyebrow}</span>
        </p>
        <h1
          className={plan.title.length > 28 ? 'plan-name plan-name--long' : 'plan-name'}
          data-route-focus="page"
          tabIndex={-1}
        >
          {plan.title}
        </h1>
        <p className="when">
          <b>
            {f.dateLong(plan.date)}
            {plan.endDate ? ` – ${f.dateLong(plan.endDate)}` : ''}
          </b>
          <span>{plan.city}</span>
          <span>
            {t.shared.guests(f.number(plan.guests.confirmed), f.number(plan.guests.expected))}
          </span>
        </p>
        <p className="shared-note">{t.shared.readOnly(f.date(plan.sharedAt.slice(0, 10)))}</p>
      </div>
      <Arch className="planhead-arch">
        <Photo photo={archPhoto(mood)} sizes={HEADER_PHOTO_SIZES} priority />
      </Arch>
    </header>
  );
}

export function SharedBudget({ budget }: { budget: NonNullable<SharedPlan['budget']> }) {
  const { t, f } = useI18n();
  return (
    <section className="card" aria-labelledby="shared-budget">
      <h2 id="shared-budget">{t.shared.budgetTitle}</h2>
      <p className="shared-total tabular">{f.money(budget.total, budget.currency)}</p>
      <table className="shared-table">
        <tbody>
          {budget.lines.map((line) => (
            <tr key={`${line.category}-${line.label ?? ''}`}>
              <th scope="row">{line.label ?? t.budgetCategories[line.category]}</th>
              <td className="tabular">{f.money(line.planned, budget.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function SharedVendors({ vendors }: { vendors: SharedPlan['vendors'] }) {
  const { t, f } = useI18n();
  const ordered = [...vendors].sort(byKey((vendor) => vendor.bookBy));
  return (
    <section className="card" aria-labelledby="shared-vendors">
      <h2 id="shared-vendors">{t.shared.vendorsTitle}</h2>
      <ul className="shared-list">
        {ordered.map((vendor) => {
          const booked = vendor.status === 'booked' || vendor.status === 'paid';
          return (
            <li key={`${vendor.category}-${vendor.label ?? ''}`}>
              <span>{vendor.label ?? t.vendorCategories[vendor.category]}</span>
              <span className={`pill ${booked ? 'pill--ok' : 'pill--plain'}`}>
                {t.vendorStatuses[vendor.status]}
              </span>
              <span className="note mt-0">{t.shared.bookBy(f.dateShort(vendor.bookBy))}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function SharedTasks({ tasks }: { tasks: SharedPlan['tasks'] }) {
  const { t, f } = useI18n();
  const ordered = [...tasks].sort(byKey((task) => task.dueDate));
  return (
    <section className="card" aria-labelledby="shared-tasks">
      <h2 id="shared-tasks">{t.shared.tasksTitle}</h2>
      <ul className="shared-list">
        {ordered.map((task, index) => {
          const done = task.status === 'done';
          return (
            <li key={`${task.dueDate}-${String(index)}`}>
              <span className={done ? 'shared-done' : undefined}>{task.title}</span>
              <span className={`pill ${done ? 'pill--ok' : 'pill--plain'}`}>
                {t.taskStatuses[task.status]}
              </span>
              <span className="note mt-0">{t.shared.due(f.dateShort(task.dueDate))}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function SharedIdeas({ plan }: { plan: SharedPlan }) {
  const { t } = useI18n();
  return (
    <section aria-labelledby="shared-ideas">
      <h2 id="shared-ideas" className="shared-section-title">
        {t.shared.ideasTitle}
      </h2>
      <ul className="shared-ideas">
        {plan.ideas.map((idea, index) => (
          <li key={`${idea.kind}-${String(index)}`} className="card">
            <p className="kicker">{t.ideaKinds[idea.kind]}</p>
            <h3 {...writtenIn(plan.language)}>{idea.title}</h3>
            <p {...writtenIn(plan.language)}>{idea.description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SharedSchedule({ plan }: { plan: SharedPlan }) {
  const { t, f } = useI18n();
  const ordered = [...plan.schedule].sort(byKey((slot) => `${slot.day}T${slot.time}`));
  return (
    <section className="card" aria-labelledby="shared-schedule">
      <h2 id="shared-schedule">{t.shared.scheduleTitle}</h2>
      <ol className="shared-list">
        {ordered.map((slot, index) => (
          <li key={`${slot.day}-${slot.time}-${String(index)}`}>
            <span className="tabular shared-when">
              {f.dateShort(slot.day)}, {f.time(slot.time)}
            </span>
            <span {...writtenIn(plan.language)}>{slot.title}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function SharedRisks({ plan }: { plan: SharedPlan }) {
  const { t } = useI18n();
  return (
    <section className="card" aria-labelledby="shared-risks">
      <h2 id="shared-risks">{t.shared.risksTitle}</h2>
      <ul className="shared-risks">
        {plan.risks.map((risk, index) => (
          <li key={`${risk.title}-${String(index)}`}>
            <b {...writtenIn(plan.language)}>{risk.title}</b>
            <span className="pill pill--plain">{t.overview.likelihood[risk.likelihood]}</span>
            <p {...writtenIn(plan.language)}>{risk.mitigation}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
