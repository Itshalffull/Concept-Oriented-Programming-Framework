// ============================================================
// CronEditor — Vanilla DOM Widget
//
// Cron expression editor with visual schedule builder.
// ============================================================

export interface CronEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  showPreview?: boolean;
  disabled?: boolean;
  className?: string;
}

export interface CronEditorOptions { target: HTMLElement; props: CronEditorProps; }

let _cronEditorUid = 0;

export class CronEditor {
  private el: HTMLElement;
  private props: CronEditorProps;
  private uid: string;
  private state = 'idle';

  constructor(options: CronEditorOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `cron-editor-${++_cronEditorUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'cron-editor');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<CronEditorProps>): void {
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
