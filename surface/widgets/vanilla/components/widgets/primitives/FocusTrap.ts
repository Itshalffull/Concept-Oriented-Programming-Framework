// ============================================================
// FocusTrap — Vanilla DOM Widget
//
// Traps keyboard focus within a container. Uses sentinel
// elements at start/end to loop focus when tabbing.
// ============================================================

export interface FocusTrapProps {
  active?: boolean;
  initialFocus?: string;
  returnFocus?: boolean;
  loop?: boolean;
  className?: string;
}

export interface FocusTrapOptions {
  target: HTMLElement;
  props: FocusTrapProps;
}

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('data-focus-sentinel'),
  );
}

const sentinelStyle = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0';

export class FocusTrap {
  private el: HTMLElement;
  private props: FocusTrapProps;
  private previousFocus: Element | null = null;
  private sentinelStart: HTMLElement;
  private sentinelEnd: HTMLElement;
  private contentSlot: HTMLElement;

  constructor(options: FocusTrapOptions) {
    const { target, props } = options;
    this.props = { active: false, returnFocus: true, loop: true, ...props };

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'focus-trap');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.sentinelStart = document.createElement('span');
    this.sentinelStart.setAttribute('data-part', 'sentinel-start');
    this.sentinelStart.setAttribute('data-focus-sentinel', '');
    this.sentinelStart.setAttribute('aria-hidden', 'true');
    this.sentinelStart.style.cssText = sentinelStyle;
    this.sentinelStart.addEventListener('focus', () => this.handleStartFocus());

    this.sentinelEnd = document.createElement('span');
    this.sentinelEnd.setAttribute('data-part', 'sentinel-end');
    this.sentinelEnd.setAttribute('data-focus-sentinel', '');
    this.sentinelEnd.setAttribute('aria-hidden', 'true');
    this.sentinelEnd.style.cssText = sentinelStyle;
    this.sentinelEnd.addEventListener('focus', () => this.handleEndFocus());

    this.contentSlot = document.createElement('div');
    this.contentSlot.setAttribute('data-part', 'content');

    this.el.appendChild(this.sentinelStart);
    this.el.appendChild(this.contentSlot);
    this.el.appendChild(this.sentinelEnd);

    this.syncState();
    if (this.props.active) this.activate();

    target.appendChild(this.el);
  }

  /** Returns the content slot where child elements should be appended */
  getContentSlot(): HTMLElement {
    return this.contentSlot;
  }

  getElement(): HTMLElement {
    return this.el;
  }

  update(props: Partial<FocusTrapProps>): void {
    const wasActive = this.props.active;
    Object.assign(this.props, props);
    if (props.className !== undefined) this.el.className = props.className || '';
    this.syncState();
    if (!wasActive && this.props.active) this.activate();
    if (wasActive && !this.props.active) this.deactivate();
  }

  destroy(): void {
    this.deactivate();
    if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
  }

  private activate(): void {
    this.previousFocus = document.activeElement;
    requestAnimationFrame(() => {
      if (this.props.initialFocus) {
        const target = this.el.querySelector<HTMLElement>(this.props.initialFocus);
        if (target) { target.focus(); return; }
      }
      const focusable = getFocusableElements(this.el);
      if (focusable.length > 0) focusable[0].focus();
    });
  }

  private deactivate(): void {
    if (this.props.returnFocus && this.previousFocus instanceof HTMLElement) {
      this.previousFocus.focus();
    }
  }

  private handleStartFocus(): void {
    if (!this.props.active || !this.props.loop) return;
    const focusable = getFocusableElements(this.el);
    if (focusable.length > 0) focusable[focusable.length - 1].focus();
  }

  private handleEndFocus(): void {
    if (!this.props.active || !this.props.loop) return;
    const focusable = getFocusableElements(this.el);
    if (focusable.length > 0) focusable[0].focus();
  }

  private syncState(): void {
    const active = !!this.props.active;
    this.el.setAttribute('data-state', active ? 'active' : 'inactive');
    this.el.setAttribute('data-focus-trap', active ? 'true' : 'false');
    this.sentinelStart.tabIndex = active ? 0 : -1;
    this.sentinelEnd.tabIndex = active ? 0 : -1;
  }
}
