// ============================================================
// StepIndicator — Vanilla DOM Widget
//
// Step indicator with completed/active/upcoming states.
// ============================================================

export interface StepIndicatorProps {
  steps: { label: string; description?: string }[];
  activeStep?: number;
  orientation?: "horizontal" | "vertical";
  onStepClick?: (index: number) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export interface StepIndicatorOptions { target: HTMLElement; props: StepIndicatorProps; }

let _stepIndicatorUid = 0;

export class StepIndicator {
  private el: HTMLElement;
  private props: StepIndicatorProps;
  private uid: string;
  private state = 'idle';

  constructor(options: StepIndicatorOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `step-indicator-${++_stepIndicatorUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'step-indicator');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<StepIndicatorProps>): void {
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
