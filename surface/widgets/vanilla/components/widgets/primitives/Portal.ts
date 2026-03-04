// ============================================================
// Portal — Vanilla DOM Widget
//
// Moves child content to a target container (or document.body).
// Supports disabled mode where content stays in-place.
// ============================================================

export interface PortalProps {
  target?: string;
  disabled?: boolean;
  className?: string;
}

export interface PortalOptions {
  target: HTMLElement;
  props: PortalProps;
}

export class Portal {
  private el: HTMLElement;
  private props: PortalProps;
  private container: Element | null = null;
  private originalParent: HTMLElement;

  constructor(options: PortalOptions) {
    const { target, props } = options;
    this.props = { disabled: false, ...props };
    this.originalParent = target;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'portal');
    this.el.setAttribute('data-part', 'root');
    this.el.setAttribute('data-portal', 'true');
    if (this.props.className) this.el.className = this.props.className;

    this.mount();
  }

  /** Returns the portal element where content should be placed */
  getElement(): HTMLElement {
    return this.el;
  }

  update(props: Partial<PortalProps>): void {
    const needsRemount = props.target !== undefined || props.disabled !== undefined;
    Object.assign(this.props, props);
    if (props.className !== undefined) this.el.className = props.className || '';
    if (needsRemount) {
      this.unmount();
      this.mount();
    }
  }

  destroy(): void {
    this.unmount();
  }

  private mount(): void {
    if (this.props.disabled) {
      this.el.setAttribute('data-state', 'unmounted');
      this.el.setAttribute('data-disabled', 'true');
      if (this.props.target) this.el.setAttribute('data-target', this.props.target);
      this.originalParent.appendChild(this.el);
      return;
    }

    if (this.props.target) {
      this.container = document.querySelector(this.props.target) || document.body;
    } else {
      this.container = document.body;
    }

    this.el.setAttribute('data-state', 'mounted');
    this.el.setAttribute('data-disabled', 'false');
    if (this.props.target) this.el.setAttribute('data-target', this.props.target);
    this.container.appendChild(this.el);
  }

  private unmount(): void {
    if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
  }
}
