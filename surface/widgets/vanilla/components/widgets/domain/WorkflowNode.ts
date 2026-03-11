// ============================================================
// WorkflowNode — Vanilla DOM Widget
//
// Individual workflow node with input/output ports.
// ============================================================

export interface WorkflowNodeProps {
  id: string;
  label: string;
  type?: "trigger" | "action" | "condition" | "transform";
  status?: "idle" | "running" | "success" | "error";
  ports?: { id: string; type: "input" | "output"; label?: string }[];
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

export interface WorkflowNodeOptions { target: HTMLElement; props: WorkflowNodeProps; }

let _workflowNodeUid = 0;

export class WorkflowNode {
  private el: HTMLElement;
  private props: WorkflowNodeProps;
  private uid: string;
  private state = 'idle';

  constructor(options: WorkflowNodeOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `workflow-node-${++_workflowNodeUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'workflow-node');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<WorkflowNodeProps>): void {
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
