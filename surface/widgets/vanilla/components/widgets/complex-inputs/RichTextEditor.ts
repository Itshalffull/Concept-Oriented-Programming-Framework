// ============================================================
// RichTextEditor — Vanilla DOM Widget
//
// WYSIWYG rich text editor with formatting toolbar.
// ============================================================

export interface RichTextEditorProps {
  value?: string;
  placeholder?: string;
  readOnly?: boolean;
  disabled?: boolean;
  toolbar?: string[];
  onChange?: (value: string) => void;
  className?: string;
}

export interface RichTextEditorOptions { target: HTMLElement; props: RichTextEditorProps; }

let _richTextEditorUid = 0;

export class RichTextEditor {
  private el: HTMLElement;
  private props: RichTextEditorProps;
  private uid: string;
  private state = 'idle';

  constructor(options: RichTextEditorOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `rich-text-editor-${++_richTextEditorUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'rich-text-editor');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<RichTextEditorProps>): void {
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
