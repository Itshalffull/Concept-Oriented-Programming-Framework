// ============================================================
// Icon — Vanilla DOM Widget
//
// Renders a named icon with optional accessible label.
// Decorative icons are hidden from assistive technology.
// ============================================================

export interface IconProps {
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  decorative?: boolean;
  label?: string;
  className?: string;
}

export interface IconOptions {
  target: HTMLElement;
  props: IconProps;
}

export class Icon {
  private el: HTMLElement;
  private props: IconProps;

  constructor(options: IconOptions) {
    const { target, props } = options;
    this.props = { name: '', size: 'md', decorative: true, ...props };

    this.el = document.createElement('span');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'icon');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;
    this.syncState();

    target.appendChild(this.el);
  }

  getElement(): HTMLElement {
    return this.el;
  }

  update(props: Partial<IconProps>): void {
    Object.assign(this.props, props);
    if (props.className !== undefined) this.el.className = props.className || '';
    this.syncState();
  }

  destroy(): void {
    if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
  }

  private syncState(): void {
    const { name, size, decorative, label } = this.props;
    this.el.setAttribute('data-icon', name || '');
    this.el.setAttribute('data-size', size!);
    this.el.setAttribute('role', decorative ? 'presentation' : 'img');
    this.el.setAttribute('aria-hidden', decorative ? 'true' : 'false');
    if (!decorative && label) {
      this.el.setAttribute('aria-label', label);
    } else {
      this.el.removeAttribute('aria-label');
    }
  }
}
