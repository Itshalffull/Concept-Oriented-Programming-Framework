// ============================================================
// FileUpload — Vanilla DOM Widget
//
// Drag-and-drop file upload with progress and file list.
// ============================================================

export interface FileUploadProps {
  accept?: string;
  multiple?: boolean;
  maxSize?: number;
  maxFiles?: number;
  disabled?: boolean;
  files?: { name: string; size: number; progress?: number; error?: string }[];
  onFilesChange?: (files: File[]) => void;
  onRemove?: (index: number) => void;
  className?: string;
}

export interface FileUploadOptions { target: HTMLElement; props: FileUploadProps; }

let _fileUploadUid = 0;

export class FileUpload {
  private el: HTMLElement;
  private props: FileUploadProps;
  private uid: string;
  private state = 'idle';

  constructor(options: FileUploadOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `file-upload-${++_fileUploadUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'file-upload');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<FileUploadProps>): void {
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
