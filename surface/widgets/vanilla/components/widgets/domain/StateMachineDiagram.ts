// ============================================================
// StateMachineDiagram — Vanilla DOM Widget
//
// Visual state machine with states and transitions.
// ============================================================

export interface StateMachineDiagramProps {
  states: { id: string; label: string; x?: number; y?: number; initial?: boolean; final?: boolean }[];
  transitions: { from: string; to: string; label?: string; event?: string }[];
  activeStateId?: string;
  onStateClick?: (id: string) => void;
  onTransitionClick?: (from: string, to: string) => void;
  className?: string;
}

export interface StateMachineDiagramOptions { target: HTMLElement; props: StateMachineDiagramProps; }

let _stateMachineDiagramUid = 0;

export class StateMachineDiagram {
  private el: HTMLElement;
  private props: StateMachineDiagramProps;
  private uid: string;
  private state = 'idle';

  constructor(options: StateMachineDiagramOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `state-machine-diagram-${++_stateMachineDiagramUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'state-machine-diagram');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<StateMachineDiagramProps>): void {
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
