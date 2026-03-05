export type SegmentedProgressBarState = 'idle' | 'animating' | 'segmentHovered';
export type SegmentedProgressBarEvent =
  | { type: 'HOVER_SEGMENT' }
  | { type: 'ANIMATE_IN' }
  | { type: 'ANIMATION_END' }
  | { type: 'LEAVE' };

export function segmentedProgressBarReducer(state: SegmentedProgressBarState, event: SegmentedProgressBarEvent): SegmentedProgressBarState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER_SEGMENT') return 'segmentHovered';
      if (event.type === 'ANIMATE_IN') return 'animating';
      return state;
    case 'animating':
      if (event.type === 'ANIMATION_END') return 'idle';
      return state;
    case 'segmentHovered':
      if (event.type === 'LEAVE') return 'idle';
      return state;
    default:
      return state;
  }
}

export interface SegmentedProgressBarProps { [key: string]: unknown; className?: string; }
export interface SegmentedProgressBarOptions { target: HTMLElement; props: SegmentedProgressBarProps; }

let _segmentedProgressBarUid = 0;

export class SegmentedProgressBar {
  private el: HTMLElement;
  private props: SegmentedProgressBarProps;
  private state: SegmentedProgressBarState = 'idle';

  constructor(options: SegmentedProgressBarOptions) {
    this.props = { ...options.props };
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'segmented-progress-bar');
    this.el.setAttribute('data-part', 'root');
    this.el.setAttribute('role', 'img');
    this.el.setAttribute('tabindex', '0');
    this.el.id = 'segmented-progress-bar-' + (++_segmentedProgressBarUid);
    this.render();
    options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  send(type: string): void {
    this.state = segmentedProgressBarReducer(this.state, { type } as any);
    this.el.setAttribute('data-state', this.state);
  }

  update(props: Partial<SegmentedProgressBarProps>): void {
    Object.assign(this.props, props);
    this.el.innerHTML = '';
    this.render();
  }

  destroy(): void { this.el.remove(); }

  private render(): void {
    this.el.setAttribute('data-state', this.state);
    if (this.props.className) this.el.className = this.props.className as string;
    const bar = document.createElement('div');
    bar.setAttribute('data-part', 'bar');
    this.el.appendChild(bar);
    const segment = document.createElement('div');
    segment.setAttribute('data-part', 'segment');
    this.el.appendChild(segment);
    const segmentLabel = document.createElement('span');
    segmentLabel.setAttribute('data-part', 'segment-label');
    this.el.appendChild(segmentLabel);
    const legend = document.createElement('div');
    legend.setAttribute('data-part', 'legend');
    this.el.appendChild(legend);
    const totalLabel = document.createElement('span');
    totalLabel.setAttribute('data-part', 'total-label');
    this.el.appendChild(totalLabel);
  }
}

export default SegmentedProgressBar;
