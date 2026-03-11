// ============================================================
// ProgressBar — Vanilla DOM Widget
//
// Determinate or indeterminate progress bar with label and value text.
// ============================================================

export interface ProgressBarProps {
  value?: number;
  min?: number;
  max?: number;
  label?: string;
  showValueText?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export interface ProgressBarOptions { target: HTMLElement; props: ProgressBarProps; }

let _progressBarUid = 0;

export class ProgressBar {
  private el: HTMLElement;
  private props: ProgressBarProps;
  private uid: string;
  private state = 'idle';

  constructor(options: ProgressBarOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `progress-bar-${++_progressBarUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'progress-bar');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<ProgressBarProps>): void {
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
