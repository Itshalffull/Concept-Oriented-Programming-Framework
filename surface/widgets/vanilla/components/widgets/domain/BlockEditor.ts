// ============================================================
// BlockEditor — Vanilla DOM Widget
//
// Block-based content editor with drag-and-drop and slash menu.
// ============================================================

export interface BlockEditorProps {
  blocks: { id: string; type: string; content?: string }[];
  ariaLabel?: string;
  readOnly?: boolean;
  placeholder?: string;
  blockTypes?: string[];
  autoFocus?: boolean;
  spellCheck?: boolean;
  onBlocksChange?: (blocks: unknown[]) => void;
  onBlockTypeSelect?: (type: string) => void;
  className?: string;
}

export interface BlockEditorOptions { target: HTMLElement; props: BlockEditorProps; }

let _blockEditorUid = 0;

export class BlockEditor {
  private el: HTMLElement;
  private props: BlockEditorProps;
  private uid: string;
  private state = 'idle';

  constructor(options: BlockEditorOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `block-editor-${++_blockEditorUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'block-editor');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<BlockEditorProps>): void {
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
