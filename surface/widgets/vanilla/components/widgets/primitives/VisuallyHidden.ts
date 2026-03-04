// ============================================================
// VisuallyHidden — Vanilla DOM Widget
//
// Renders content that is visually hidden but accessible to
// screen readers. Uses the standard clip-rect technique.
// ============================================================

export interface VisuallyHiddenProps {
  text?: string;
  className?: string;
}

export interface VisuallyHiddenOptions {
  target: HTMLElement;
  props: VisuallyHiddenProps;
}

const VH_STYLE = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0';

export class VisuallyHidden {
  private el: HTMLElement;
  private props: VisuallyHiddenProps;

  constructor(options: VisuallyHiddenOptions) {
    const { target, props } = options;
    this.props = { text: '', ...props };

    this.el = document.createElement('span');
    this.el.style.cssText = VH_STYLE;
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'visually-hidden');
    this.el.setAttribute('data-part', 'root');
    this.el.textContent = this.props.text || '';
    if (this.props.className) this.el.className = this.props.className;

    target.appendChild(this.el);
  }

  getElement(): HTMLElement {
    return this.el;
  }

  update(props: Partial<VisuallyHiddenProps>): void {
    if (props.text !== undefined) {
      this.props.text = props.text;
      this.el.textContent = props.text;
    }
    if (props.className !== undefined) this.el.className = props.className || '';
  }

  destroy(): void {
    if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
  }
}
