// ============================================================
// FormulaEditor — Vanilla DOM Widget
//
// Formula/expression editor with function autocomplete.
// ============================================================

export interface FormulaEditorProps {
  value?: string;
  functions?: { name: string; description?: string; syntax?: string }[];
  disabled?: boolean;
  placeholder?: string;
  onChange?: (value: string) => void;
  onValidate?: (valid: boolean) => void;
  className?: string;
}

export interface FormulaEditorOptions { target: HTMLElement; props: FormulaEditorProps; }

let _formulaEditorUid = 0;

export class FormulaEditor {
  private el: HTMLElement;
  private props: FormulaEditorProps;
  private uid: string;
  private state = 'idle';

  constructor(options: FormulaEditorOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `formula-editor-${++_formulaEditorUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'formula-editor');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<FormulaEditorProps>): void {
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
