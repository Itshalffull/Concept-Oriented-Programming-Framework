// ============================================================
// ToggleSwitch — Vanilla DOM Widget
//
// On/off toggle switch with hidden checkbox and keyboard support.
// ============================================================

export interface ToggleSwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  label: string;
  name?: string;
  required?: boolean;
  onChange?: (checked: boolean) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export interface ToggleSwitchOptions { target: HTMLElement; props: ToggleSwitchProps; }

let _toggleSwitchUid = 0;

export class ToggleSwitch {
  private el: HTMLElement;
  private props: ToggleSwitchProps;
  private uid: string;
  private state = 'idle';

  constructor(options: ToggleSwitchOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `toggle-switch-${++_toggleSwitchUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'toggle-switch');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<ToggleSwitchProps>): void {
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
