// ============================================================
// ImageGallery — Vanilla DOM Widget
//
// Image gallery with lightbox, thumbnails, and navigation.
// ============================================================

export interface ImageGalleryProps {
  images: { src: string; alt?: string; caption?: string }[];
  selectedIndex?: number;
  layout?: "grid" | "masonry" | "carousel";
  onSelect?: (index: number) => void;
  lightbox?: boolean;
  className?: string;
}

export interface ImageGalleryOptions { target: HTMLElement; props: ImageGalleryProps; }

let _imageGalleryUid = 0;

export class ImageGallery {
  private el: HTMLElement;
  private props: ImageGalleryProps;
  private uid: string;
  private state = 'idle';

  constructor(options: ImageGalleryOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `image-gallery-${++_imageGalleryUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'image-gallery');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<ImageGalleryProps>): void {
    Object.assign(this.props, props);
    if (props.className !== undefined) this.el.className = props.className || '';
    this.el.innerHTML = '';
    this.render();
  }

  destroy(): void { if (this.el.parentNode) this.el.parentNode.removeChild(this.el); }

  private render(): void {
    this.syncState();
  }

  private syncState(): void {
    this.el.setAttribute('data-state', this.state);
  }
}
