// ============================================================
// ScrollLock — Vanilla DOM Widget
//
// Prevents body scroll when active. Preserves scrollbar gap
// to avoid layout shift. Restores scroll position on deactivate.
// ============================================================

export interface ScrollLockProps {
  active?: boolean;
  preserveScrollbarGap?: boolean;
  className?: string;
}

export interface ScrollLockOptions {
  target: HTMLElement;
  props: ScrollLockProps;
}

export class ScrollLock {
  private el: HTMLElement;
  private props: ScrollLockProps;
  private scrollPosition = 0;
  private originalOverflow = '';
  private originalPaddingRight = '';

  constructor(options: ScrollLockOptions) {
    const { target, props } = options;
    this.props = { active: false, preserveScrollbarGap: true, ...props };

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'scroll-lock');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;
    this.syncState();

    if (this.props.active) this.lock();

    target.appendChild(this.el);
  }

  getElement(): HTMLElement {
    return this.el;
  }

  update(props: Partial<ScrollLockProps>): void {
    const wasActive = this.props.active;
    Object.assign(this.props, props);
    if (props.className !== undefined) this.el.className = props.className || '';

    if (!wasActive && this.props.active) this.lock();
    if (wasActive && !this.props.active) this.unlock();
    this.syncState();
  }

  destroy(): void {
    if (this.props.active) this.unlock();
    if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
  }

  private lock(): void {
    this.scrollPosition = window.scrollY;
    this.originalOverflow = document.body.style.overflow;
    this.originalPaddingRight = document.body.style.paddingRight;
    document.body.style.overflow = 'hidden';

    if (this.props.preserveScrollbarGap) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
    }
  }

  private unlock(): void {
    document.body.style.overflow = this.originalOverflow;
    document.body.style.paddingRight = this.originalPaddingRight;
    window.scrollTo(0, this.scrollPosition);
  }

  private syncState(): void {
    this.el.setAttribute('data-state', this.props.active ? 'locked' : 'unlocked');
    this.el.setAttribute('data-scroll-lock', this.props.active ? 'true' : 'false');
    this.el.setAttribute('data-preserve-gap', this.props.preserveScrollbarGap ? 'true' : 'false');
  }
}
