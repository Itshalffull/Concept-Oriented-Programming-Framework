// ============================================================
// Label — Vanilla DOM Widget
//
// Form label element with optional required indicator.
// ============================================================

export interface LabelProps {
  text?: string;
  htmlFor?: string;
  required?: boolean;
  className?: string;
}

export interface LabelOptions {
  target: HTMLElement;
  props: LabelProps;
}

export class Label {
  private el: HTMLLabelElement;
  private props: LabelProps;
  private textNode: Text;
  private requiredEl: HTMLElement;

  constructor(options: LabelOptions) {
    const { target, props } = options;
    this.props = { text: '', required: false, ...props };

    this.el = document.createElement('label');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'label');
    this.el.setAttribute('data-part', 'root');
    if (this.props.htmlFor) this.el.htmlFor = this.props.htmlFor;
    if (this.props.className) this.el.className = this.props.className;

    this.textNode = document.createTextNode(this.props.text || '');
    this.el.appendChild(this.textNode);

    this.requiredEl = document.createElement('span');
    this.requiredEl.setAttribute('data-part', 'required-indicator');
    this.requiredEl.setAttribute('aria-hidden', 'true');
    this.syncRequired();
    this.el.appendChild(this.requiredEl);

    target.appendChild(this.el);
  }

  getElement(): HTMLElement {
    return this.el;
  }

  update(props: Partial<LabelProps>): void {
    if (props.text !== undefined) {
      this.props.text = props.text;
      this.textNode.textContent = props.text;
    }
    if (props.htmlFor !== undefined) {
      this.props.htmlFor = props.htmlFor;
      this.el.htmlFor = props.htmlFor || '';
    }
    if (props.required !== undefined) {
      this.props.required = props.required;
      this.syncRequired();
    }
    if (props.className !== undefined) this.el.className = props.className || '';
  }

  destroy(): void {
    if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
  }

  private syncRequired(): void {
    this.requiredEl.setAttribute('data-visible', this.props.required ? 'true' : 'false');
    this.requiredEl.textContent = this.props.required ? ' *' : '';
  }
}
