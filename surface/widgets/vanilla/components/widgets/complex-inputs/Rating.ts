// ============================================================
// Rating — Vanilla DOM Widget
//
// Star rating input with half-star and read-only support.
// ============================================================

export interface RatingProps {
  value?: number;
  defaultValue?: number;
  max?: number;
  allowHalf?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  label?: string;
  onChange?: (value: number) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export interface RatingOptions { target: HTMLElement; props: RatingProps; }

let _ratingUid = 0;

export class Rating {
  private el: HTMLElement;
  private props: RatingProps;
  private uid: string;
  private state = 'idle';

  constructor(options: RatingOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `rating-${++_ratingUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'rating');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<RatingProps>): void {
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
