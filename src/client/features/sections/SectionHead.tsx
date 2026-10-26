/**
 * The heading of a plan section, with its introduction and any actions; it receives focus when
 * the user switches sections.
 */
import type { ReactNode } from 'react';

export function SectionHead({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children?: ReactNode;
}) {
  return (
    <div className="section-head">
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
