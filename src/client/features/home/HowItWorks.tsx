/** "One sentence in": the four parts Mehfil drafts, each with its 3D picture. */
import type { ArtName } from '../../art';
import { Art } from '../../art/Art';
import { useI18n } from '../../i18n';

/** In the order of t.home.how: budget, timeline, vendors, ideas. */
const PICTURES: readonly ArtName[] = ['money-bag', 'calendar', 'clipboard', 'bulb'];

export function HowItWorks() {
  const { t } = useI18n();
  return (
    <section className="band band--how" aria-labelledby="how-title">
      <div className="wrap">
        <div className="band-head">
          <h2 id="how-title">{t.home.howTitle}</h2>
          <p>{t.home.howText}</p>
        </div>
        <ul className="how">
          {t.home.how.map((item, index) => (
            <li key={item.title}>
              <span className="how-pic" aria-hidden="true">
                <Art name={PICTURES[index] ?? 'sparkles'} size={88} afterLoad />
              </span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
