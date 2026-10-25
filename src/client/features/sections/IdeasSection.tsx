/**
 * Ideas: themes with colour palettes, food, decor and personal touches from Gemini. People keep
 * the ones they love and can ask for different ideas in their own words; kept ideas survive.
 */
import { Heart, Sparkles, Trash2, WandSparkles } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import type { EventPlan, Idea } from '../../../shared/schemas/plan';
import { IDEA_KINDS, type IdeaKind } from '../../../shared/schemas/primitives';
import { announce, toast } from '../../app/feedback';
import { useI18n } from '../../i18n';
import { writtenIn } from '../../i18n/written-in';
import { refineSection } from '../../state/ai';
import { useEdit } from '../plan/use-edit';
import { SectionHead } from './SectionHead';

type KindFilter = IdeaKind | 'all' | 'kept';

function IdeaCard({ plan, idea }: { plan: EventPlan; idea: Idea }) {
  const { t } = useI18n();
  const edit = useEdit(plan.id);
  return (
    <li className={idea.kind === 'theme' ? 'idea idea--theme' : 'idea'}>
      <div className="idea-top">
        <span className="pill pill--plain">{t.ideaKinds[idea.kind]}</span>
        {idea.costLevel && <span className="pill pill--plain">{t.costLevels[idea.costLevel]}</span>}
        {idea.source === 'ai' && (
          <span className="pill pill--ai">
            <Sparkles />
            Gemini
          </span>
        )}
      </div>
      <h3 {...writtenIn(plan.brief.language)}>{idea.title}</h3>
      {idea.palette && idea.palette.length > 0 && (
        <ul className="palette" aria-label={t.ideasSection.palette(String(idea.palette.length))}>
          {idea.palette.map((color) => (
            <li key={color} style={{ background: color }} title={color} />
          ))}
        </ul>
      )}
      <p {...writtenIn(plan.brief.language)}>{idea.description}</p>
      <div className="idea-actions">
        <button
          type="button"
          className={idea.favorite ? 'btn btn--primary btn--sm' : 'btn btn--ghost btn--sm'}
          aria-pressed={idea.favorite}
          onClick={() =>
            edit({ type: 'idea.update', id: idea.id, patch: { favorite: !idea.favorite } })
          }
        >
          <Heart />
          {idea.favorite ? t.ideasSection.kept : t.ideasSection.keep}
          <span className="sr-only">: {idea.title}</span>
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label={t.ideasSection.remove(idea.title)}
          onClick={() => edit({ type: 'idea.remove', id: idea.id })}
        >
          <Trash2 />
        </button>
      </div>
    </li>
  );
}

export function IdeasSection({ plan }: { plan: EventPlan }) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<KindFilter>('all');
  const [instruction, setInstruction] = useState('');
  const [busy, setBusy] = useState(false);
  const kinds = IDEA_KINDS.filter((kind) => plan.ideas.some((idea) => idea.kind === kind));
  const shown = plan.ideas.filter((idea) =>
    filter === 'all' ? true : filter === 'kept' ? idea.favorite : idea.kind === filter,
  );

  const refine = async (text: string) => {
    const request = text.trim();
    if (!request || busy) return;
    setBusy(true);
    try {
      await refineSection(plan.id, 'ideas', request);
      setInstruction('');
      setFilter('all');
      announce(t.ideasSection.refined);
      toast(t.ideasSection.refined);
    } catch {
      toast(t.ideasSection.refineError, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    void refine(instruction);
  };

  return (
    <section className="ws-main" aria-labelledby="section-title">
      <SectionHead title={t.ideasSection.title} intro={t.ideasSection.intro} />

      <form className="card refine" onSubmit={submit}>
        <h3 className="flex items-center gap-2 text-2xl">
          <WandSparkles className="i" />
          {t.ideasSection.refineTitle}
        </h3>
        <div className="chips-row">
          {t.ideasSection.refineChips.map((chip) => (
            <button
              key={chip}
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={busy}
              onClick={() => void refine(chip)}
            >
              {chip}
            </button>
          ))}
        </div>
        <div className="composer">
          <label className="sr-only" htmlFor="refine-input">
            {t.ideasSection.refineLabel}
          </label>
          <input
            id="refine-input"
            className="input"
            maxLength={300}
            placeholder={t.ideasSection.refinePlaceholder}
            value={instruction}
            onChange={(event) => {
              setInstruction(event.target.value);
            }}
          />
          <button type="submit" aria-label={t.ideasSection.refineButton} disabled={busy}>
            {busy ? <span className="spinner" aria-hidden="true" /> : <Sparkles />}
          </button>
        </div>
        <p className="note" role="status">
          {busy ? t.ideasSection.refining : t.ideasSection.refineNote}
        </p>
      </form>

      {plan.ideas.length === 0 ? (
        <p className="card empty">{t.ideasSection.empty}</p>
      ) : (
        <>
          <div className="filters" role="group" aria-label={t.ideasSection.filterLabel}>
            {(['all', ...kinds, 'kept'] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={filter === option}
                onClick={() => {
                  setFilter(option);
                }}
              >
                {option === 'all'
                  ? t.ideasSection.all
                  : option === 'kept'
                    ? t.ideasSection.keptOnly
                    : t.ideaKinds[option]}
              </button>
            ))}
          </div>
          <ul className="ideas">
            {shown.map((idea) => (
              <IdeaCard key={idea.id} plan={plan} idea={idea} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
