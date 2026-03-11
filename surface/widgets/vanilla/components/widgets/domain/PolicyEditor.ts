// ============================================================
// PolicyEditor — Vanilla DOM Widget
//
// Access policy editor with rules and validation.
// ============================================================

export interface PolicyEditorProps {
  value?: string;
  services?: { name: string; actions: string[] }[];
  validationErrors?: { line: number; message: string }[];
  onChange?: (value: string) => void;
  readOnly?: boolean;
  className?: string;
}

export interface PolicyEditorOptions { target: HTMLElement; props: PolicyEditorProps; }

let _policyEditorUid = 0;

export class PolicyEditor {
  private el: HTMLElement;
  private props: PolicyEditorProps;
  private uid: string;
  private state = 'idle';

  constructor(options: PolicyEditorOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `policy-editor-${++_policyEditorUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'policy-editor');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<PolicyEditorProps>): void {
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
