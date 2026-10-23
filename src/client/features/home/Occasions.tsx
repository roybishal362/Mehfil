/** "What are we celebrating?": four jharokha arches that start a plan for each occasion. */
import { Link } from 'wouter';
import { EVENT_TYPES } from '../../../shared/schemas/primitives';
import { paths } from '../../app/routing';
import { useTheme } from '../../app/theme';
import { useI18n } from '../../i18n';
import { OccasionIcon } from '../../motifs/OccasionIcon';
import { Divider } from '../../motifs/Ornaments';

export function Occasions() {
  const { t } = useI18n();
  const day = useTheme((state) => state.theme === 'day');
  return (
    <section className="band" aria-labelledby="occasions-title">
      <div className="wrap">
        <Divider />
        <div className="sec-title">
          <h2 id="occasions-title">{t.home.occasionsTitle}</h2>
          <p>{t.home.occasionsText}</p>
        </div>
        <ul className="occasions">
          {EVENT_TYPES.map((type) => (
            <li key={type}>
              <Link className={`arch arch--${type}`} href={paths.newPlan(type)}>
                <span className="medal">
                  <OccasionIcon type={type} day={day} />
                </span>
                <h3>{t.home.occasions[type].title}</h3>
                <p>{t.home.occasions[type].text}</p>
                <span className="go" aria-hidden="true">
                  {t.home.begin} →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
