// ============================================================
// ConditionBuilder — Vanilla DOM Widget
//
// Visual condition/rule builder with groups and rows.
// ============================================================

export interface ConditionBuilderProps {
  fields: { name: string; label: string; type: string; operators: string[] }[];
  conditions?: { field: string; operator: string; value: string }[];
  logic?: "and" | "or";
  onConditionsChange?: (conditions: unknown[]) => void;
  onLogicChange?: (logic: string) => void;
  className?: string;
}

export interface ConditionBuilderOptions { target: HTMLElement; props: ConditionBuilderProps; }

let _conditionBuilderUid = 0;

export class ConditionBuilder {
  private el: HTMLElement;
  private props: ConditionBuilderProps;
  private uid: string;
  private state = 'idle';

  constructor(options: ConditionBuilderOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `condition-builder-${++_conditionBuilderUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'condition-builder');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<ConditionBuilderProps>): void {
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
