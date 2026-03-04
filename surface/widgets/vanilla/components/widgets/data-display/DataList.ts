// ============================================================
// DataList — Vanilla DOM Widget
//
// Definition-style data list with label-value pairs.
// ============================================================

export interface DataListProps {
  items: { label: string; value: string }[];
  orientation?: "horizontal" | "vertical";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export interface DataListOptions { target: HTMLElement; props: DataListProps; }

let _dataListUid = 0;

export class DataList {
  private el: HTMLElement;
  private props: DataListProps;
  private uid: string;
  private state = 'idle';

  constructor(options: DataListOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `data-list-${++_dataListUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'data-list');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<DataListProps>): void {
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
