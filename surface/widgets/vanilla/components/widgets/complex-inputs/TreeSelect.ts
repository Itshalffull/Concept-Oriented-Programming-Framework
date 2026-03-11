// ============================================================
// TreeSelect — Vanilla DOM Widget
//
// Hierarchical tree selection with expand/collapse nodes.
// ============================================================

export interface TreeSelectProps {
  nodes: { id: string; label: string; children?: any[]; disabled?: boolean }[];
  value?: string;
  defaultValue?: string;
  multiple?: boolean;
  expandedIds?: string[];
  onSelect?: (id: string) => void;
  onExpand?: (ids: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export interface TreeSelectOptions { target: HTMLElement; props: TreeSelectProps; }

let _treeSelectUid = 0;

export class TreeSelect {
  private el: HTMLElement;
  private props: TreeSelectProps;
  private uid: string;
  private state = 'idle';

  constructor(options: TreeSelectOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `tree-select-${++_treeSelectUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'tree-select');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<TreeSelectProps>): void {
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
