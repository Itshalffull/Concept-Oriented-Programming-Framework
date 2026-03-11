// ============================================================
// RadioGroup — Vanilla DOM Widget
//
// Radio button group with arrow-key navigation.
// ============================================================

export interface RadioGroupProps {
  value?: string;
  defaultValue?: string;
  options: { value: string; label: string; disabled?: boolean }[];
  orientation?: "horizontal" | "vertical";
  label: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  onChange?: (value: string) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export interface RadioGroupOptions { target: HTMLElement; props: RadioGroupProps; }

let _radioGroupUid = 0;

export class RadioGroup {
  private el: HTMLElement;
  private props: RadioGroupProps;
  private uid: string;
  private state = 'idle';

  constructor(options: RadioGroupOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `radio-group-${++_radioGroupUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'radio-group');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<RadioGroupProps>): void {
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
