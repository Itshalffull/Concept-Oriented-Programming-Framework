// ============================================================
// FileBrowser — Vanilla DOM Widget
//
// File system browser with tree navigation and file list.
// ============================================================

export interface FileBrowserProps {
  files?: { name: string; type: "file" | "folder"; size?: number; modified?: string }[];
  currentPath?: string;
  onNavigate?: (path: string) => void;
  onFileSelect?: (name: string) => void;
  viewMode?: "list" | "grid";
  loading?: boolean;
  className?: string;
}

export interface FileBrowserOptions { target: HTMLElement; props: FileBrowserProps; }

let _fileBrowserUid = 0;

export class FileBrowser {
  private el: HTMLElement;
  private props: FileBrowserProps;
  private uid: string;
  private state = 'idle';

  constructor(options: FileBrowserOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `file-browser-${++_fileBrowserUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'file-browser');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<FileBrowserProps>): void {
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
