// ============================================================
// NumberInput — Vanilla DOM Widget
//
// Numeric input with increment/decrement buttons, min/max, and step.
// ============================================================

export interface NumberInputProps {
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  label: string;
  description?: string;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  readOnly?: boolean;
  name?: string;
  onChange?: (value: number | undefined) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export interface NumberInputOptions { target: HTMLElement; props: NumberInputProps; }

let _numberInputUid = 0;

export class NumberInput {
  private el: HTMLElement;
  private props: NumberInputProps;
  private uid: string;
  private state = 'idle';

  constructor(options: NumberInputOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `number-input-${++_numberInputUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'number-input');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<NumberInputProps>): void {
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
