// ============================================================
// Card — Vanilla DOM Widget
//
// Content card with header, body, media, footer, and actions.
// ============================================================

export interface CardProps {
  variant?: "elevated" | "filled" | "outlined";
  clickable?: boolean;
  href?: string;
  padding?: "none" | "sm" | "md" | "lg";
  size?: "sm" | "md" | "lg";
  title?: string;
  description?: string;
  onClick?: () => void;
  className?: string;
}

export interface CardOptions { target: HTMLElement; props: CardProps; }

let _cardUid = 0;

export class Card {
  private el: HTMLElement;
  private props: CardProps;
  private uid: string;
  private state = 'idle';

  constructor(options: CardOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `card-${++_cardUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'card');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<CardProps>): void {
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
