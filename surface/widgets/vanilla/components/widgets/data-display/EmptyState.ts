// ============================================================
// EmptyState — Vanilla DOM Widget
//
// Placeholder for empty content areas with optional action.
// ============================================================

export interface EmptyStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export interface EmptyStateOptions { target: HTMLElement; props: EmptyStateProps; }

let _emptyStateUid = 0;

export class EmptyState {
  private el: HTMLElement;
  private props: EmptyStateProps;
  private uid: string;
  private state = 'idle';

  constructor(options: EmptyStateOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `empty-state-${++_emptyStateUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'empty-state');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<EmptyStateProps>): void {
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
