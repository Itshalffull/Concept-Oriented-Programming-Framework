// ============================================================
// ImageGallery -- Vue 3 Component
//
// Clef Surface widget. Vue 3 Composition API with h() render.
// ============================================================

import {
  defineComponent,
  h,
  type PropType,
  type VNode,
  ref,
  onMounted,
  onUnmounted,
  watch,
} from 'vue';

export interface GalleryImage {
  src: string;
  alt: string;
  thumbnail?: string;
}

export interface ImageGalleryProps {
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
  closeIcon?: VNode | string;
  /** Called when lightbox index changes. */
  onIndexChange?: (index: number) => void;
}

export const ImageGallery = defineComponent({
  name: 'ImageGallery',

  props: {
    images: { type: Array as PropType<any[]>, required: true as const },
    currentIndex: { type: Number, default: 0 },
    ariaLabel: { type: String, default: 'Image Gallery' },
    columns: { type: Number, default: 3 },
    gap: { type: String, default: '8px' },
    loop: { type: Boolean, default: true },
    lazyLoad: { type: Boolean, default: true },
    aspectRatio: { type: String, default: '1/1' },
    closeIcon: { type: null as unknown as PropType<any> },
    onIndexChange: { type: Function as PropType<(...args: any[]) => any> },
  },

  emits: ['index-change'],

  setup(props, { slots, emit }) {
    const state = ref<any>({ mode: 'grid', currentIndex: props.currentIndex, });
    const send = (action: any) => { /* state machine dispatch */ };
    const triggerRef = ref<any>(null);
    const clampIndex = (i: number) => {
      if (props.loop) return ((i % props.images.length) + props.images.length) % props.images.length;
      return Math.max(0, Math.min(props.images.length - 1, i));
    };

  const handleNext = () => {
    const next = clampIndex(idx + 1);
    send({ type: 'NEXT' });
    props.onIndexChange?.(next);
  };
    const handlePrev = () => {
    const prev = clampIndex(idx - 1);
    send({ type: 'PREV' });
    props.onIndexChange?.(prev);
  };
    const handleOpen = (index: number) => {
      send({ type: 'OPEN_LIGHTBOX', index });
    };

  (() => {
    if (!isLightbox) return;
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') send({ type: 'ESCAPE' });
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  };
    const next = clampIndex(idx + 1);
    const prev = clampIndex(idx - 1);

    return (): VNode =>
      h('div', {
        'role': 'region',
        'aria-label': props.ariaLabel,
        'aria-roledescription': 'image gallery',
        'data-surface-widget': '',
        'data-widget-name': 'image-gallery',
        'data-state': isLightbox ? 'lightbox' : 'grid',
        'data-image-count': props.images.length,
      }, [
        h('div', {
          'role': 'grid',
          'aria-label': `${ariaLabel} thumbnails`,
          'data-part': 'grid',
          'data-columns': props.columns,
          'style': {
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          props.gap,
        },
        }, [
          ...props.images.map((img, i) => h('button', {
              'ref': i === idx ? triggerRef : undefined,
              'type': 'button',
              'role': 'gridcell',
              'aria-label': `Image ${i + 1} of ${images.length}: ${img.alt}`,
              'data-part': 'thumbnail',
              'data-index': i,
              'data-aspect-ratio': props.aspectRatio,
              'tabindex': i === idx ? 0 : -1,
              'onClick': () => handleOpen(i),
            }, [
              h('img', {
                'src': img.thumbnail ?? img.src,
                'alt': img.alt,
                'loading': props.lazyLoad ? 'lazy' : 'eager',
                'style': { props.aspectRatio },
              }),
            ])),
        ]),
        isLightbox && currentImage ? h('div', {
            'data-part': 'lightbox',
            'role': 'dialog',
            'aria-modal': 'true',
            'aria-label': `Image viewer: ${currentImage.alt}`,
            'data-state': 'open',
          }, [
            h('button', {
              'type': 'button',
              'role': 'button',
              'aria-label': 'Previous image',
              'aria-disabled': !props.loop && idx === 0 ? 'true' : undefined,
              'data-part': 'prev',
              'onClick': handlePrev,
            }, '&#x2039;'),
            h('div', { 'data-part': 'lightbox-image', 'data-index': clampIndex(idx) }, [
              h('img', {
                'role': 'img',
                'src': currentImage.src,
                'alt': currentImage.alt,
                'aria-label': currentImage.alt,
              }),
            ]),
            h('button', {
              'type': 'button',
              'role': 'button',
              'aria-label': 'Next image',
              'aria-disabled': !props.loop && idx === props.images.length - 1 ? 'true' : undefined,
              'data-part': 'next',
              'onClick': handleNext,
            }, '&#x203A;'),
            h('span', {
              'data-part': 'counter',
              'role': 'status',
              'aria-live': 'polite',
            }, [
              clampIndex(idx) + 1,
              'of',
              props.images.length,
            ]),
            h('button', {
              'type': 'button',
              'role': 'button',
              'aria-label': 'Close image viewer',
              'data-part': 'close',
              'onClick': () => send({ type: 'CLOSE' }),
            }, [
              props.closeIcon ?? '\u2715',
            ]),
          ]) : null,
      ]);
  },
});)

export default ImageGallery;