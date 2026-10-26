/**
 * "One sentence in": the four parts Mehfil drafts, as numbered steps. The list itself carries
 * the order, so the large numerals are decoration.
 */
import { useI18n } from '../../i18n';

export function HowItWorks() {
  const { t } = useI18n();
  return (
    <section className="band band--how" aria-labelledby="how-title">
      <div className="wrap">
        <div className="band-head">
          <h2 id="how-title">{t.home.howTitle}</h2>
          <p>{t.home.howText}</p>
        </div>
        <ol className="how">
          {t.home.how.map((item, index) => (
            <li key={item.title}>
              <span className="how-num" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
