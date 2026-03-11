// ============================================================
// CodeBlock — Vanilla DOM Widget
//
// Syntax-highlighted code block with copy button and line numbers.
// ============================================================

export interface CodeBlockProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  highlightLines?: number[];
  copyable?: boolean;
  title?: string;
  onCopy?: () => void;
  className?: string;
}

export interface CodeBlockOptions { target: HTMLElement; props: CodeBlockProps; }

let _codeBlockUid = 0;

export class CodeBlock {
  private el: HTMLElement;
  private props: CodeBlockProps;
  private uid: string;
  private state = 'idle';

  constructor(options: CodeBlockOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `code-block-${++_codeBlockUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'code-block');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<CodeBlockProps>): void {
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
