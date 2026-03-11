// ============================================================
// MasterDetail — Vanilla DOM Widget
//
// Master-detail layout with list and detail pane.
// ============================================================

export interface MasterDetailProps {
  items: { id: string; label: string; description?: string }[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  orientation?: "horizontal" | "vertical";
  className?: string;
}

export interface MasterDetailOptions { target: HTMLElement; props: MasterDetailProps; }

let _masterDetailUid = 0;

export class MasterDetail {
  private el: HTMLElement;
  private props: MasterDetailProps;
  private uid: string;
  private state = 'idle';

  constructor(options: MasterDetailOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `master-detail-${++_masterDetailUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'master-detail');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<MasterDetailProps>): void {
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
