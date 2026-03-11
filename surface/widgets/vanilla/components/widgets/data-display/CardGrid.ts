// ============================================================
// CardGrid — Vanilla DOM Widget
//
// Responsive grid layout for card collections.
// ============================================================

export interface CardGridProps {
  columns?: number;
  gap?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export interface CardGridOptions { target: HTMLElement; props: CardGridProps; }

let _cardGridUid = 0;

export class CardGrid {
  private el: HTMLElement;
  private props: CardGridProps;
  private uid: string;
  private state = 'idle';

  constructor(options: CardGridOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `card-grid-${++_cardGridUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'card-grid');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<CardGridProps>): void {
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
