/**
 * The photographers, in the footer: each photo's title, author and licence, linked to its
 * source page, as the Creative Commons licences ask.
 */
import { useI18n } from '../i18n';
import { PHOTO_CREDITS } from './credits';

export function PhotoCredits() {
  const { t } = useI18n();
  return (
    <details className="photo-credits">
      <summary>{t.shell.photoCredits}</summary>
      <p>{t.shell.photoCreditsIntro}</p>
      <ul>
        {PHOTO_CREDITS.map((credit) => (
          <li key={credit.source}>
            <a href={credit.source} target="_blank" rel="noopener noreferrer">
              {credit.title}
            </a>
            {' · '}
            {credit.author}
            {' · '}
            <a href={credit.licenseUrl} target="_blank" rel="noopener noreferrer">
              {credit.license}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
