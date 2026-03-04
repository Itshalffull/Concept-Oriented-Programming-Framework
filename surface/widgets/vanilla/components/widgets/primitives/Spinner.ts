// ============================================================
// Spinner — Vanilla DOM Widget
//
// Indeterminate loading indicator with track and indicator parts.
// ============================================================

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  trackVisible?: boolean;
  className?: string;
}

export interface SpinnerOptions {
  target: HTMLElement;
  props: SpinnerProps;
}

export class Spinner {
  private el: HTMLElement;
  private props: SpinnerProps;
  private trackEl: HTMLElement;
  private indicatorEl: HTMLElement;
  private labelEl: HTMLElement | null = null;

  constructor(options: SpinnerOptions) {
    const { target, props } = options;
    this.props = { size: 'md', trackVisible: true, ...props };

    this.el = document.createElement('div');
    this.el.setAttribute('role', 'progressbar');
    this.el.setAttribute('aria-valuemin', '0');
    this.el.setAttribute('aria-valuemax', '100');
    this.el.setAttribute('aria-label', this.props.label || 'Loading');
    this.el.setAttribute('aria-busy', 'true');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'spinner');
    this.el.setAttribute('data-part', 'root');
    this.el.setAttribute('data-size', this.props.size!);
    if (this.props.className) this.el.className = this.props.className;

    this.trackEl = document.createElement('span');
    this.trackEl.setAttribute('data-part', 'track');
    this.trackEl.setAttribute('data-visible', this.props.trackVisible ? 'true' : 'false');
    this.trackEl.setAttribute('aria-hidden', 'true');
    this.el.appendChild(this.trackEl);

    this.indicatorEl = document.createElement('span');
    this.indicatorEl.setAttribute('data-part', 'indicator');
    this.indicatorEl.setAttribute('aria-hidden', 'true');
    this.el.appendChild(this.indicatorEl);

    if (this.props.label) {
      this.labelEl = document.createElement('span');
      this.labelEl.setAttribute('data-part', 'label');
      this.labelEl.setAttribute('data-visible', 'true');
      this.labelEl.textContent = this.props.label;
      this.el.appendChild(this.labelEl);
    }

    target.appendChild(this.el);
  }

  getElement(): HTMLElement {
    return this.el;
  }

  update(props: Partial<SpinnerProps>): void {
    Object.assign(this.props, props);
    if (props.size !== undefined) this.el.setAttribute('data-size', props.size);
    if (props.label !== undefined) {
      this.el.setAttribute('aria-label', props.label || 'Loading');
      if (this.labelEl) this.labelEl.textContent = props.label || '';
    }
    if (props.trackVisible !== undefined) {
      this.trackEl.setAttribute('data-visible', props.trackVisible ? 'true' : 'false');
    }
    if (props.className !== undefined) this.el.className = props.className || '';
  }

  destroy(): void {
    if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
  }
}
