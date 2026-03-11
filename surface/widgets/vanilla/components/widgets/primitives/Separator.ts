// ============================================================
// Separator — Vanilla DOM Widget
//
// Visual divider line, horizontal or vertical.
// ============================================================

export interface SeparatorProps {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

export interface SeparatorOptions {
  target: HTMLElement;
  props: SeparatorProps;
}

export class Separator {
  private el: HTMLElement;
  private props: SeparatorProps;

  constructor(options: SeparatorOptions) {
    const { target, props } = options;
    this.props = { orientation: 'horizontal', ...props };

    this.el = document.createElement('div');
    this.el.setAttribute('role', 'separator');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'separator');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;
    this.syncState();

    target.appendChild(this.el);
  }

  getElement(): HTMLElement {
    return this.el;
  }

  update(props: Partial<SeparatorProps>): void {
    Object.assign(this.props, props);
    if (props.className !== undefined) this.el.className = props.className || '';
    this.syncState();
  }

  destroy(): void {
    if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
  }

  private syncState(): void {
    this.el.setAttribute('aria-orientation', this.props.orientation!);
    this.el.setAttribute('data-orientation', this.props.orientation!);
  }
}
