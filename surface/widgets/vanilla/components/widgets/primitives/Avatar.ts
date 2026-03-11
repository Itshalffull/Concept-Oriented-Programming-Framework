// ============================================================
// Avatar — Vanilla DOM Widget
//
// Displays a user avatar image with fallback initials.
// Manages loading/loaded/error states for the image source.
// ============================================================

export interface AvatarProps {
  src?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  delayMs?: number;
  className?: string;
}

export interface AvatarOptions {
  target: HTMLElement;
  props: AvatarProps;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export class Avatar {
  private el: HTMLElement;
  private props: AvatarProps;
  private state: 'loading' | 'loaded' | 'error' = 'loading';
  private imgEl: HTMLImageElement | null = null;
  private fallbackEl: HTMLElement;

  constructor(options: AvatarOptions) {
    const { target, props } = options;
    this.props = { name: '', size: 'md', delayMs: 0, ...props };

    this.el = document.createElement('div');
    this.el.setAttribute('role', 'img');
    this.el.setAttribute('aria-label', this.props.name || '');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'avatar');
    this.el.setAttribute('data-part', 'root');
    this.el.setAttribute('data-size', this.props.size!);
    this.el.setAttribute('data-state', 'loading');
    if (this.props.className) this.el.className = this.props.className;

    // Fallback
    this.fallbackEl = document.createElement('span');
    this.fallbackEl.setAttribute('data-part', 'fallback');
    this.fallbackEl.setAttribute('data-visible', 'true');
    this.fallbackEl.setAttribute('aria-hidden', 'true');
    this.fallbackEl.textContent = getInitials(this.props.name || '');
    this.el.appendChild(this.fallbackEl);

    if (this.props.src) {
      this.createImage(this.props.src);
    }

    target.appendChild(this.el);
  }

  getElement(): HTMLElement {
    return this.el;
  }

  update(props: Partial<AvatarProps>): void {
    if (props.name !== undefined) {
      this.props.name = props.name;
      this.el.setAttribute('aria-label', props.name);
      this.fallbackEl.textContent = getInitials(props.name);
    }
    if (props.size !== undefined) {
      this.props.size = props.size;
      this.el.setAttribute('data-size', props.size);
    }
    if (props.className !== undefined) {
      this.el.className = props.className || '';
    }
    if (props.src !== undefined && props.src !== this.props.src) {
      this.props.src = props.src;
      this.state = 'loading';
      this.el.setAttribute('data-state', 'loading');
      if (this.imgEl) {
        this.imgEl.remove();
        this.imgEl = null;
      }
      this.fallbackEl.style.display = '';
      this.fallbackEl.setAttribute('data-visible', 'true');
      if (props.src) {
        this.createImage(props.src);
      }
    }
  }

  destroy(): void {
    if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
  }

  private createImage(src: string): void {
    this.imgEl = document.createElement('img');
    this.imgEl.setAttribute('data-part', 'image');
    this.imgEl.setAttribute('data-visible', 'false');
    this.imgEl.alt = this.props.name || '';
    this.imgEl.src = src;
    this.imgEl.style.display = 'none';

    this.imgEl.addEventListener('load', () => {
      const apply = () => {
        this.state = 'loaded';
        this.el.setAttribute('data-state', 'loaded');
        if (this.imgEl) {
          this.imgEl.setAttribute('data-visible', 'true');
          this.imgEl.style.display = '';
        }
        this.fallbackEl.setAttribute('data-visible', 'false');
        this.fallbackEl.style.display = 'none';
      };
      if (this.props.delayMs && this.props.delayMs > 0) {
        setTimeout(apply, this.props.delayMs);
      } else {
        apply();
      }
    });

    this.imgEl.addEventListener('error', () => {
      this.state = 'error';
      this.el.setAttribute('data-state', 'error');
    });

    this.el.insertBefore(this.imgEl, this.fallbackEl);
  }
}
