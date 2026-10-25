/**
 * The heading of a plan section, with its 3D picture; it receives focus when the user switches
 * sections.
 */
import type { ReactNode } from 'react';
import type { ArtName } from '../../art';
import { Art } from '../../art/Art';

export function SectionHead({
  title,
  intro,
  art,
  children,
}: {
  title: string;
  intro?: string;
  art: ArtName;
  children?: ReactNode;
}) {
  return (
    <div className="section-head">
      <span className="section-art" aria-hidden="true">
        <Art name={art} size={64} />
      </span>
      <div>
        <h2 id="section-title" data-route-focus="section" tabIndex={-1}>
          {title}
        </h2>
        {intro && <p>{intro}</p>}
      </div>
      {children && <div className="actions">{children}</div>}
    </div>
  );
}
