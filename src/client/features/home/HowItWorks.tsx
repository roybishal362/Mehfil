/**
 * "One sentence in": the four parts Mehfil drafts, each with a small drawing of how that part
 * looks in a plan (a split budget bar, a timeline with today marked, a checklist, a palette).
 */
import { useI18n } from '../../i18n';

const BUDGET_SEGMENTS = [
  { x: 0, width: 46, tone: 'c1' },
  { x: 49, width: 30, tone: 'c2' },
  { x: 82, width: 20, tone: 'c3' },
  { x: 105, width: 11, tone: 'c4' },
  { x: 119, width: 9, tone: 'c6' },
] as const;

const TIMELINE_DOTS = [8, 34, 60, 86, 112];
const CHECK_ROWS = [12, 30, 48];
const SWATCHES = [
  { cx: 40, tone: 'c5' },
  { cx: 64, tone: 'c2' },
  { cx: 88, tone: 'c3' },
] as const;

function Picture({ index }: { index: number }) {
  switch (index) {
    case 0:
      return (
        <>
          {BUDGET_SEGMENTS.map(({ x, width, tone }) => (
            <rect
              key={tone}
              className={`fill-${tone}`}
              x={x}
              y="18"
              width={width}
              height="20"
              rx="3"
            />
          ))}
          <path className="stroke-line" d="M0 52H128" />
          <path className="stroke-ink" d="M0 52H84" />
        </>
      );
    case 1:
      return (
        <>
          <path className="stroke-line" d="M8 32H112" />
          <path className="stroke-ink" d="M8 32H60" />
          {TIMELINE_DOTS.map((x) => (
            <circle key={x} className={x <= 60 ? 'fill-ink' : 'fill-line'} cx={x} cy="32" r="4" />
          ))}
          <circle className="stroke-accent" cx="60" cy="32" r="9" />
        </>
      );
    case 2:
      return (
        <>
          {CHECK_ROWS.map((y, row) => (
            <g key={y}>
              <rect className="stroke-ink" x="10" y={y - 6} width="12" height="12" rx="3" />
              {row < 2 && <path className="stroke-accent" d={`M13 ${String(y)}l3 3 5-6`} />}
              <path
                className="stroke-line"
                d={`M32 ${String(y)}H${String(row === 1 ? 92 : 112)}`}
              />
            </g>
          ))}
        </>
      );
    default:
      return (
        <>
          {SWATCHES.map(({ cx, tone }) => (
            <circle key={tone} className={`fill-${tone}`} cx={cx} cy="32" r="20" />
          ))}
        </>
      );
  }
}

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
              <svg className="how-pic" viewBox="0 0 128 64" aria-hidden="true" focusable="false">
                <Picture index={index} />
              </svg>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
