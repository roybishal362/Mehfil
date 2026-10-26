/**
 * A photograph. Photos are decoration (the words beside them carry the meaning), so they have
 * empty alt text. They load lazily, except the one on the first screen (`priority`), which the
 * browser fetches first. Width and height reserve the space, so nothing shifts as they arrive.
 */
import type { ArchPhoto } from '.';

export interface PhotoProps {
  photo: ArchPhoto;
  /** How wide the photo shows, so the browser picks the right file (the `sizes` attribute). */
  sizes: string;
  className?: string;
  priority?: boolean;
}

export function Photo({ photo, sizes, className = '', priority = false }: PhotoProps) {
  return (
    <img
      className={`photo ${className}`}
      src={photo.src}
      srcSet={photo.srcSet}
      sizes={sizes}
      width={photo.width}
      height={photo.height}
      alt=""
      // The first screen's photo is painted as soon as it arrives; the rest decode off-thread.
      decoding={priority ? 'auto' : 'async'}
      draggable={false}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
    />
  );
}
