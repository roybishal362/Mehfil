/**
 * "What are we celebrating?": one card per occasion, each in its festival's colour. Durga Puja,
 * Ganpati and Diwali start the form with the festival already named, so the plan picks up its
 * look straight away.
 */
import { Link } from 'wouter';
import type { Mood } from '../../../shared/domain/mood';
import type { EventType } from '../../../shared/schemas/primitives';
import { paths } from '../../app/routing';
import { useI18n, type Messages } from '../../i18n';
import { OccasionArt, type OccasionKind } from '../../motifs/OccasionArt';

type Festival = keyof Messages['home']['festivals'];

interface Card {
  key: Festival;
  type: EventType;
  /** Festivals are named in the form's "kind of celebration" field. */
  named: boolean;
  mood: Mood;
  art: OccasionKind;
}

const CARDS: readonly Card[] = [
  { key: 'wedding', type: 'wedding', named: false, mood: 'wedding', art: 'wedding' },
  { key: 'durga', type: 'community', named: true, mood: 'durga', art: 'durga' },
  { key: 'ganpati', type: 'community', named: true, mood: 'ganpati', art: 'ganpati' },
  { key: 'birthday', type: 'birthday', named: false, mood: 'birthday', art: 'birthday' },
  { key: 'diwali', type: 'other', named: true, mood: 'diwali', art: 'diwali' },
  { key: 'other', type: 'other', named: false, mood: 'neutral', art: 'other' },
];

export function Occasions() {
  const { t } = useI18n();
  return (
    <section className="band" aria-labelledby="occasions-title">
      <div className="wrap">
        <div className="band-head">
          <h2 id="occasions-title">{t.home.occasionsTitle}</h2>
          <p>{t.home.occasionsText}</p>
        </div>
        <ul className="occasions">
          {CARDS.map((card) => {
            const { title, text } = t.home.festivals[card.key];
            return (
              <li key={card.key}>
                <Link
                  className="occasion"
                  data-mood={card.mood}
                  href={paths.newPlan(card.type, card.named ? title : undefined)}
                >
                  <span className="occasion-pic">
                    <OccasionArt kind={card.art} />
                  </span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                  <span className="go" aria-hidden="true">
                    {t.home.begin} →
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
