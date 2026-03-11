// ============================================================
// Fieldset — Vanilla DOM Widget
//
// Form fieldset group with legend and disabled state.
// ============================================================

export interface FieldsetProps {
  legend?: string;
  disabled?: boolean;
  description?: string;
  className?: string;
}

export interface FieldsetOptions { target: HTMLElement; props: FieldsetProps; }

let _fieldsetUid = 0;

export class Fieldset {
  private el: HTMLElement;
  private props: FieldsetProps;
  private uid: string;
  private state = 'idle';

  constructor(options: FieldsetOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `fieldset-${++_fieldsetUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'fieldset');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<FieldsetProps>): void {
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
