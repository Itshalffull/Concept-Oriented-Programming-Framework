// ============================================================
// ChipInput — Vanilla DOM Widget
//
// Tag/chip input with autocomplete suggestions and validation.
// ============================================================

export interface ChipInputProps {
  values?: string[];
  defaultValues?: string[];
  allowCreate?: boolean;
  maxItems?: number;
  separator?: string;
  label: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  suggestions?: string[];
  validateValue?: string;
  onChange?: (values: string[]) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export interface ChipInputOptions { target: HTMLElement; props: ChipInputProps; }

let _chipInputUid = 0;

export class ChipInput {
  private el: HTMLElement;
  private props: ChipInputProps;
  private uid: string;
  private state = 'idle';

  constructor(options: ChipInputOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `chip-input-${++_chipInputUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'chip-input');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<ChipInputProps>): void {
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
