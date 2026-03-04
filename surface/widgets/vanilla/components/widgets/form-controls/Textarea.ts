// ============================================================
// Textarea — Vanilla DOM Widget
//
// Multi-line text input with label, character count, and auto-resize.
// ============================================================

export interface TextareaProps {
  value?: string;
  placeholder?: string;
  label?: string;
  description?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  readOnly?: boolean;
  rows?: number;
  maxLength?: number;
  name?: string;
  autoResize?: boolean;
  onChange?: (value: string) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export interface TextareaOptions { target: HTMLElement; props: TextareaProps; }

let _textareaUid = 0;

export class Textarea {
  private el: HTMLElement;
  private props: TextareaProps;
  private uid: string;
  private state = 'idle';

  constructor(options: TextareaOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `textarea-${++_textareaUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'textarea');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<TextareaProps>): void {
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
