// ============================================================
// MarkdownPreview — Vanilla DOM Widget
//
// Rendered Markdown preview with sanitized HTML output.
// ============================================================

export interface MarkdownPreviewProps {
  source: string;
  sanitize?: boolean;
  allowHtml?: boolean;
  className?: string;
}

export interface MarkdownPreviewOptions { target: HTMLElement; props: MarkdownPreviewProps; }

let _markdownPreviewUid = 0;

export class MarkdownPreview {
  private el: HTMLElement;
  private props: MarkdownPreviewProps;
  private uid: string;
  private state = 'idle';

  constructor(options: MarkdownPreviewOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `markdown-preview-${++_markdownPreviewUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'markdown-preview');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<MarkdownPreviewProps>): void {
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
