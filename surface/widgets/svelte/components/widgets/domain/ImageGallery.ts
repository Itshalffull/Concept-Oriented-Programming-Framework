import { uid } from '../shared/uid.js';

export interface GalleryImage {
  id: string;
  src: string;
  alt?: string;
  thumbnail?: string;
  caption?: string;
}

export interface ImageGalleryProps {
  images: GalleryImage[];
  selectedIndex?: number;
  viewMode?: 'grid' | 'masonry' | 'carousel';
  columns?: number;
  showCaptions?: boolean;
  lightbox?: boolean;
  loading?: boolean;
  onSelect?: (index: number) => void;
  onNavigate?: (index: number) => void;
  children?: string | HTMLElement;
}

export interface ImageGalleryInstance {
  element: HTMLElement;
  update(props: Partial<ImageGalleryProps>): void;
  destroy(): void;
}

export function createImageGallery(options: {
  target: HTMLElement;
  props: ImageGalleryProps;
}): ImageGalleryInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];
  let lightboxOpen = false;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'image-gallery');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Image gallery');
  root.id = id;

  const gridEl = document.createElement('div');
  gridEl.setAttribute('data-part', 'grid');
  gridEl.setAttribute('role', 'list');
  root.appendChild(gridEl);

  const lightboxEl = document.createElement('div');
  lightboxEl.setAttribute('data-part', 'lightbox');
  lightboxEl.setAttribute('role', 'dialog');
  lightboxEl.setAttribute('aria-modal', 'true');
  lightboxEl.setAttribute('aria-label', 'Image viewer');
  root.appendChild(lightboxEl);

  const lightboxImg = document.createElement('img');
  lightboxImg.setAttribute('data-part', 'lightbox-image');
  lightboxEl.appendChild(lightboxImg);

  const prevBtn = document.createElement('button');
  prevBtn.setAttribute('data-part', 'prev-button');
  prevBtn.setAttribute('type', 'button');
  prevBtn.setAttribute('aria-label', 'Previous image');
  prevBtn.textContent = '\u2190';
  lightboxEl.appendChild(prevBtn);

  const nextBtn = document.createElement('button');
  nextBtn.setAttribute('data-part', 'next-button');
  nextBtn.setAttribute('type', 'button');
  nextBtn.setAttribute('aria-label', 'Next image');
  nextBtn.textContent = '\u2192';
  lightboxEl.appendChild(nextBtn);

  const closeBtn = document.createElement('button');
  closeBtn.setAttribute('data-part', 'close-button');
  closeBtn.setAttribute('type', 'button');
  closeBtn.setAttribute('aria-label', 'Close lightbox');
  closeBtn.textContent = '\u00d7';
  lightboxEl.appendChild(closeBtn);

  prevBtn.addEventListener('click', () => {
    const idx = Math.max(0, (currentProps.selectedIndex ?? 0) - 1);
    currentProps.onNavigate?.(idx);
  });
  nextBtn.addEventListener('click', () => {
    const idx = Math.min(currentProps.images.length - 1, (currentProps.selectedIndex ?? 0) + 1);
    currentProps.onNavigate?.(idx);
  });
  closeBtn.addEventListener('click', () => { lightboxOpen = false; sync(); });
  cleanups.push(() => {});

  lightboxEl.addEventListener('keydown', ((e: KeyboardEvent) => {
    if (e.key === 'Escape') { lightboxOpen = false; sync(); }
    if (e.key === 'ArrowLeft') prevBtn.click();
    if (e.key === 'ArrowRight') nextBtn.click();
  }) as EventListener);

  function renderGrid() {
    gridEl.innerHTML = '';
    currentProps.images.forEach((img, i) => {
      const item = document.createElement('div');
      item.setAttribute('data-part', 'gallery-item');
      item.setAttribute('role', 'listitem');
      item.setAttribute('tabindex', '0');
      const imgEl = document.createElement('img');
      imgEl.src = img.thumbnail ?? img.src;
      imgEl.alt = img.alt ?? '';
      item.appendChild(imgEl);
      if (currentProps.showCaptions && img.caption) {
        const cap = document.createElement('span');
        cap.setAttribute('data-part', 'caption');
        cap.textContent = img.caption;
        item.appendChild(cap);
      }
      item.addEventListener('click', () => {
        currentProps.onSelect?.(i);
        if (currentProps.lightbox) { lightboxOpen = true; sync(); }
      });
      item.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') item.click(); });
      gridEl.appendChild(item);
    });
  }

  function sync() {
    const loading = currentProps.loading ?? false;
    root.setAttribute('data-state', loading ? 'loading' : lightboxOpen ? 'lightbox' : 'idle');
    root.setAttribute('aria-busy', loading ? 'true' : 'false');
    root.setAttribute('data-view', currentProps.viewMode ?? 'grid');
    gridEl.style.gridTemplateColumns = 'repeat(' + (currentProps.columns ?? 3) + ', 1fr)';
    renderGrid();
    lightboxEl.style.display = lightboxOpen ? '' : 'none';
    const selImg = currentProps.images[currentProps.selectedIndex ?? 0];
    if (selImg) {
      lightboxImg.src = selImg.src;
      lightboxImg.alt = selImg.alt ?? '';
    }
  }

  sync();
  target.appendChild(root);

  return {
    element: root,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createImageGallery;
