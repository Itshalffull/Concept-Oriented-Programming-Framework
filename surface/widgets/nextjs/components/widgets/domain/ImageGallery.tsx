'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useReducer,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { galleryReducer } from './ImageGallery.reducer.js';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface GalleryImage {
  src: string;
  alt: string;
  thumbnail?: string;
}

export interface ImageGalleryProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Array of images. */
  images: GalleryImage[];
  /** Initial index. */
  currentIndex?: number;
  /** Accessible label. */
  ariaLabel?: string;
  /** Number of grid columns. */
  columns?: number;
  /** Gap between thumbnails. */
  gap?: string;
  /** Enable wraparound navigation. */
  loop?: boolean;
  /** Lazy-load thumbnails. */
  lazyLoad?: boolean;
  /** Aspect ratio for thumbnails. */
  aspectRatio?: string;
  /** Close button content. */
  closeIcon?: ReactNode;
  /** Called when lightbox index changes. */
  onIndexChange?: (index: number) => void;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const ImageGallery = forwardRef<HTMLDivElement, ImageGalleryProps>(function ImageGallery(
  {
    images,
    currentIndex: controlledIndex = 0,
    ariaLabel = 'Image Gallery',
    columns = 3,
    gap = '8px',
    loop = true,
    lazyLoad = true,
    aspectRatio = '1/1',
    closeIcon,
    onIndexChange,
    ...rest
  },
  ref,
) {
  const [state, send] = useReducer(galleryReducer, {
    mode: 'grid',
    currentIndex: controlledIndex,
  });
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const isLightbox = state.mode === 'lightbox';
  const idx = state.currentIndex;

  const clampIndex = useCallback(
    (i: number) => {
      if (loop) return ((i % images.length) + images.length) % images.length;
      return Math.max(0, Math.min(images.length - 1, i));
    },
    [images.length, loop],
  );

  const handleNext = useCallback(() => {
    const next = clampIndex(idx + 1);
    send({ type: 'NEXT' });
    onIndexChange?.(next);
  }, [idx, clampIndex, onIndexChange]);

  const handlePrev = useCallback(() => {
    const prev = clampIndex(idx - 1);
    send({ type: 'PREV' });
    onIndexChange?.(prev);
  }, [idx, clampIndex, onIndexChange]);

  const handleOpen = useCallback(
    (index: number) => {
      send({ type: 'OPEN_LIGHTBOX', index });
    },
    [],
  );

  useEffect(() => {
    if (!isLightbox) return;
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') send({ type: 'ESCAPE' });
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isLightbox, handleNext, handlePrev]);

  const currentImage = images[clampIndex(idx)];

  return (
    <div
      ref={ref}
      role="region"
      aria-label={ariaLabel}
      aria-roledescription="image gallery"
      data-surface-widget=""
      data-widget-name="image-gallery"
      data-state={isLightbox ? 'lightbox' : 'grid'}
      data-image-count={images.length}
      {...rest}
    >
      <div
        role="grid"
        aria-label={`${ariaLabel} thumbnails`}
        data-part="grid"
        data-columns={columns}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap,
        }}
      >
        {images.map((img, i) => (
          <button
            key={i}
            ref={i === idx ? triggerRef : undefined}
            type="button"
            role="gridcell"
            aria-label={`Image ${i + 1} of ${images.length}: ${img.alt}`}
            data-part="thumbnail"
            data-index={i}
            data-aspect-ratio={aspectRatio}
            tabIndex={i === idx ? 0 : -1}
            onClick={() => handleOpen(i)}
          >
            <img
              src={img.thumbnail ?? img.src}
              alt={img.alt}
              loading={lazyLoad ? 'lazy' : 'eager'}
              style={{ aspectRatio }}
            />
          </button>
        ))}
      </div>

      {isLightbox && currentImage && (
        <div
          data-part="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`Image viewer: ${currentImage.alt}`}
          data-state="open"
        >
          <button
            type="button"
            role="button"
            aria-label="Previous image"
            aria-disabled={!loop && idx === 0 ? 'true' : undefined}
            data-part="prev"
            onClick={handlePrev}
          >
            &#x2039;
          </button>

          <div data-part="lightbox-image" data-index={clampIndex(idx)}>
            <img
              role="img"
              src={currentImage.src}
              alt={currentImage.alt}
              aria-label={currentImage.alt}
            />
          </div>

          <button
            type="button"
            role="button"
            aria-label="Next image"
            aria-disabled={!loop && idx === images.length - 1 ? 'true' : undefined}
            data-part="next"
            onClick={handleNext}
          >
            &#x203A;
          </button>

          <span data-part="counter" role="status" aria-live="polite">
            {clampIndex(idx) + 1} of {images.length}
          </span>

          <button
            type="button"
            role="button"
            aria-label="Close image viewer"
            data-part="close"
            onClick={() => send({ type: 'CLOSE' })}
          >
            {closeIcon ?? '\u2715'}
          </button>
        </div>
      )}
    </div>
  );
});

ImageGallery.displayName = 'ImageGallery';
export { ImageGallery };
export default ImageGallery;
