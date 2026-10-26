/**
 * "What are we celebrating?": one card per occasion, each with its festival's photograph in the
 * arch. Durga Puja, Ganpati and Diwali start the form with the festival already named, so the
 * plan picks up its look straight away.
 */
import { Link } from 'wouter';
import type { Mood } from '../../../shared/domain/mood';
import type { EventType } from '../../../shared/schemas/primitives';
import { paths } from '../../app/routing';
import { useI18n, type Messages } from '../../i18n';
import { archPhoto } from '../../photos';
import { Arch } from '../../photos/Arch';
import { Photo } from '../../photos/Photo';

type Festival = keyof Messages['home']['festivals'];

interface Card {
  key: Festival;
  type: EventType;
  /** Festivals are named in the form's "kind of celebration" field. */
  named: boolean;
  mood: Mood;
}

const CARDS: readonly Card[] = [
  { key: 'wedding', type: 'wedding', named: false, mood: 'wedding' },
  { key: 'durga', type: 'community', named: true, mood: 'durga' },
  { key: 'ganpati', type: 'community', named: true, mood: 'ganpati' },
  { key: 'birthday', type: 'birthday', named: false, mood: 'birthday' },
  { key: 'diwali', type: 'other', named: true, mood: 'diwali' },
  { key: 'other', type: 'other', named: false, mood: 'neutral' },
];

/** Six across on a wide screen, three on a tablet, two on a phone. */
const SIZES = '(max-width: 640px) 44vw, (max-width: 1100px) 30vw, 180px';

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
                  <Arch className="occasion-pic">
                    <Photo photo={archPhoto(card.mood)} sizes={SIZES} />
                  </Arch>
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
