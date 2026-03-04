// ============================================================
// AutomationBuilder — Vanilla DOM Widget
//
// Visual automation workflow builder with trigger and action steps.
// ============================================================

export interface AutomationBuilderProps {
  steps?: { id: string; type: string; label: string; config?: Record<string, unknown> }[];
  onStepsChange?: (steps: unknown[]) => void;
  readOnly?: boolean;
  className?: string;
}

export interface AutomationBuilderOptions { target: HTMLElement; props: AutomationBuilderProps; }

let _automationBuilderUid = 0;

export class AutomationBuilder {
  private el: HTMLElement;
  private props: AutomationBuilderProps;
  private uid: string;
  private state = 'idle';

  constructor(options: AutomationBuilderOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `automation-builder-${++_automationBuilderUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'automation-builder');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<AutomationBuilderProps>): void {
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
