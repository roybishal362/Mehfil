/**
 * The jharokha: the pointed arch of palace windows and mandaps that frames every photograph.
 * The window is a CSS mask (styles/photos.css); the fine outline around it is drawn here and
 * keeps its hairline width at any size.
 */
import type { ReactNode } from 'react';

export function Arch({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`arch ${className}`}>
      <span className="arch-window">{children}</span>
      <svg
        className="arch-line"
        viewBox="0 0 100 125"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M0.5 125V50C0.5 26 28 12 50 0.6C72 12 99.5 26 99.5 50V125"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </span>
  );
}
