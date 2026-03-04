// ============================================================
// Splitter — Vanilla DOM Widget
//
// Resizable split panes with drag handle.
// ============================================================

export interface SplitterProps {
  orientation?: "horizontal" | "vertical";
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
  onResize?: (size: number) => void;
  className?: string;
}

export interface SplitterOptions { target: HTMLElement; props: SplitterProps; }

let _splitterUid = 0;

export class Splitter {
  private el: HTMLElement;
  private props: SplitterProps;
  private uid: string;
  private state = 'idle';

  constructor(options: SplitterOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `splitter-${++_splitterUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'splitter');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<SplitterProps>): void {
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
