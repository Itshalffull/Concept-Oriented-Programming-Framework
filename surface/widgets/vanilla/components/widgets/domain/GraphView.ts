// ============================================================
// GraphView — Vanilla DOM Widget
//
// Force-directed or hierarchical graph visualization.
// ============================================================

export interface GraphViewProps {
  nodes: { id: string; label?: string; x?: number; y?: number }[];
  edges: { source: string; target: string; label?: string }[];
  layout?: "force" | "hierarchy" | "radial";
  zoomable?: boolean;
  pannable?: boolean;
  onNodeClick?: (id: string) => void;
  onEdgeClick?: (source: string, target: string) => void;
  className?: string;
}

export interface GraphViewOptions { target: HTMLElement; props: GraphViewProps; }

let _graphViewUid = 0;

export class GraphView {
  private el: HTMLElement;
  private props: GraphViewProps;
  private uid: string;
  private state = 'idle';

  constructor(options: GraphViewOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `graph-view-${++_graphViewUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'graph-view');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<GraphViewProps>): void {
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
