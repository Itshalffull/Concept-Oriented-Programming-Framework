// ============================================================
// BacklinkPanel — Vanilla DOM Widget
//
// Panel displaying incoming and unlinked references.
// ============================================================

export interface BacklinkPanelProps {
  linkedRefs?: { id: string; title: string; excerpt?: string }[];
  unlinkedRefs?: { id: string; title: string; excerpt?: string }[];
  onRefClick?: (id: string) => void;
  onLink?: (id: string) => void;
  loading?: boolean;
  className?: string;
}

export interface BacklinkPanelOptions { target: HTMLElement; props: BacklinkPanelProps; }

let _backlinkPanelUid = 0;

export class BacklinkPanel {
  private el: HTMLElement;
  private props: BacklinkPanelProps;
  private uid: string;
  private state = 'idle';

  constructor(options: BacklinkPanelOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `backlink-panel-${++_backlinkPanelUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'backlink-panel');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<BacklinkPanelProps>): void {
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
