// ============================================================
// Stepper — Vanilla DOM Widget
//
// Multi-step progress indicator with clickable steps.
// ============================================================

export interface StepperProps {
  steps: { label: string; description?: string }[];
  activeStep?: number;
  orientation?: "horizontal" | "vertical";
  onStepClick?: (index: number) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export interface StepperOptions { target: HTMLElement; props: StepperProps; }

let _stepperUid = 0;

export class Stepper {
  private el: HTMLElement;
  private props: StepperProps;
  private uid: string;
  private state = 'idle';

  constructor(options: StepperOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `stepper-${++_stepperUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'stepper');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<StepperProps>): void {
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
