// ============================================================
// MentionInput — Vanilla DOM Widget
//
// Text input with @mention trigger and suggestion popup.
// ============================================================

export interface MentionInputProps {
  value?: string;
  triggers?: { char: string; suggestions: { id: string; label: string }[] }[];
  disabled?: boolean;
  placeholder?: string;
  onChange?: (value: string) => void;
  onMention?: (trigger: string, id: string) => void;
  className?: string;
}

export interface MentionInputOptions { target: HTMLElement; props: MentionInputProps; }

let _mentionInputUid = 0;

export class MentionInput {
  private el: HTMLElement;
  private props: MentionInputProps;
  private uid: string;
  private state = 'idle';

  constructor(options: MentionInputOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `mention-input-${++_mentionInputUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'mention-input');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<MentionInputProps>): void {
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
