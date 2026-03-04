// ============================================================
// DiffViewer — Vanilla DOM Widget
//
// Side-by-side or unified diff viewer with line numbers.
// ============================================================

export interface DiffViewerProps {
  original?: string;
  modified?: string;
  mode?: "side-by-side" | "unified";
  language?: string;
  fileName?: string;
  showLineNumbers?: boolean;
  showInlineHighlight?: boolean;
  loading?: boolean;
  additions?: number;
  deletions?: number;
  onModeChange?: (mode: "side-by-side" | "unified") => void;
  className?: string;
}

export interface DiffViewerOptions { target: HTMLElement; props: DiffViewerProps; }

let _diffViewerUid = 0;

export class DiffViewer {
  private el: HTMLElement;
  private props: DiffViewerProps;
  private uid: string;
  private state = 'idle';

  constructor(options: DiffViewerOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `diff-viewer-${++_diffViewerUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'diff-viewer');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<DiffViewerProps>): void {
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
