/**
 * A piece of 3D artwork. It is always decorative (its meaning is in the text beside it), so it
 * has empty alt text. Pictures on the first screen can wait until the page has loaded
 * (`afterLoad`), holding their space meanwhile, then fade in; the rest load as they come near
 * the screen.
 */
import { useState } from 'react';
import { artUrl, type ArtName } from '.';
import { useAfterLoad } from '../lib/after-load';

export interface ArtProps {
  name: ArtName;
  /** Display size in CSS pixels; CSS may scale it, the ratio is always square. */
  size: number;
  className?: string;
  /** Wait until the page has loaded, so the first screen's text and fonts come first. */
  afterLoad?: boolean;
}

export function Art({ name, size, className = '', afterLoad = false }: ArtProps) {
  const loaded = useAfterLoad();
  const [shown, setShown] = useState(false);
  if (afterLoad && !loaded) return <span className={`art art--waiting ${className}`} />;
  return (
    <img
      className={`art ${afterLoad ? (shown ? 'art--arrived' : 'art--arriving') : ''} ${className}`}
      src={artUrl(name, size)}
      width={size}
      height={size}
      alt=""
      decoding="async"
      draggable={false}
      {...(afterLoad
        ? {
            onLoad: () => {
              setShown(true);
            },
          }
        : { loading: 'lazy' as const })}
    />
  );
}
