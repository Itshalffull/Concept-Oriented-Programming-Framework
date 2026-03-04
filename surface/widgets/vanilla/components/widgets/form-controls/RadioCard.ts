// ============================================================
// RadioCard — Vanilla DOM Widget
//
// Card-style radio group with clickable card options.
// ============================================================

export interface RadioCardProps {
  value?: string;
  defaultValue?: string;
  options: { value: string; label: string; description?: string; disabled?: boolean }[];
  orientation?: "horizontal" | "vertical";
  label: string;
  disabled?: boolean;
  name?: string;
  onChange?: (value: string) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export interface RadioCardOptions { target: HTMLElement; props: RadioCardProps; }

let _radioCardUid = 0;

export class RadioCard {
  private el: HTMLElement;
  private props: RadioCardProps;
  private uid: string;
  private state = 'idle';

  constructor(options: RadioCardOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `radio-card-${++_radioCardUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'radio-card');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<RadioCardProps>): void {
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
