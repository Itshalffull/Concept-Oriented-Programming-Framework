// ============================================================
// TokenInput — Vanilla DOM Widget
//
// Token-based input for structured value entry.
// ============================================================

export interface TokenInputProps {
  tokens?: string[];
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  maxTokens?: number;
  onTokensChange?: (tokens: string[]) => void;
  onChange?: (value: string) => void;
  className?: string;
}

export interface TokenInputOptions { target: HTMLElement; props: TokenInputProps; }

let _tokenInputUid = 0;

export class TokenInput {
  private el: HTMLElement;
  private props: TokenInputProps;
  private uid: string;
  private state = 'idle';

  constructor(options: TokenInputOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `token-input-${++_tokenInputUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'token-input');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<TokenInputProps>): void {
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
