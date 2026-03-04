// ============================================================
// Outliner — Vanilla DOM Widget
//
// Hierarchical outline editor with indent/outdent and drag-to-reorder.
// ============================================================

export interface OutlinerProps {
  items: { id: string; content: string; children?: any[]; collapsed?: boolean }[];
  onItemsChange?: (items: unknown[]) => void;
  readOnly?: boolean;
  onFocus?: (id: string) => void;
  className?: string;
}

export interface OutlinerOptions { target: HTMLElement; props: OutlinerProps; }

let _outlinerUid = 0;

export class Outliner {
  private el: HTMLElement;
  private props: OutlinerProps;
  private uid: string;
  private state = 'idle';

  constructor(options: OutlinerOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `outliner-${++_outlinerUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'outliner');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<OutlinerProps>): void {
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
