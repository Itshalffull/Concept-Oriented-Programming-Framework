// ============================================================
// SchemaEditor — Vanilla DOM Widget
//
// Visual schema/model editor with field definitions.
// ============================================================

export interface SchemaEditorProps {
  fields?: { name: string; type: string; required?: boolean; description?: string }[];
  availableTypes?: string[];
  onFieldsChange?: (fields: { name: string; type: string; required?: boolean }[]) => void;
  readOnly?: boolean;
  title?: string;
  className?: string;
}

export interface SchemaEditorOptions { target: HTMLElement; props: SchemaEditorProps; }

let _schemaEditorUid = 0;

export class SchemaEditor {
  private el: HTMLElement;
  private props: SchemaEditorProps;
  private uid: string;
  private state = 'idle';

  constructor(options: SchemaEditorOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `schema-editor-${++_schemaEditorUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'schema-editor');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<SchemaEditorProps>): void {
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
