// ============================================================
// Timeline — Vanilla DOM Widget
//
// Vertical or horizontal timeline with events and connectors.
// ============================================================

export interface TimelineProps {
  items: { title: string; description?: string; date?: string; icon?: string; variant?: string }[];
  orientation?: "horizontal" | "vertical";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export interface TimelineOptions { target: HTMLElement; props: TimelineProps; }

let _timelineUid = 0;

export class Timeline {
  private el: HTMLElement;
  private props: TimelineProps;
  private uid: string;
  private state = 'idle';

  constructor(options: TimelineOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `timeline-${++_timelineUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'timeline');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<TimelineProps>): void {
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
