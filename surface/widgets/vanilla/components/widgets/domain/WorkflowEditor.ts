// ============================================================
// WorkflowEditor — Vanilla DOM Widget
//
// Visual workflow editor with nodes, edges, and canvas.
// ============================================================

export interface WorkflowEditorProps {
  nodes: { id: string; type: string; label: string; x: number; y: number }[];
  edges: { id: string; source: string; target: string; label?: string }[];
  onNodesChange?: (nodes: unknown[]) => void;
  onEdgesChange?: (edges: unknown[]) => void;
  readOnly?: boolean;
  onNodeSelect?: (id: string) => void;
  className?: string;
}

export interface WorkflowEditorOptions { target: HTMLElement; props: WorkflowEditorProps; }

let _workflowEditorUid = 0;

export class WorkflowEditor {
  private el: HTMLElement;
  private props: WorkflowEditorProps;
  private uid: string;
  private state = 'idle';

  constructor(options: WorkflowEditorOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `workflow-editor-${++_workflowEditorUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'workflow-editor');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<WorkflowEditorProps>): void {
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
