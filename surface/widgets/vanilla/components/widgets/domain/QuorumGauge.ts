export type QuorumGaugeState = 'belowThreshold' | 'atThreshold' | 'aboveThreshold';
export type QuorumGaugeEvent =
  | { type: 'THRESHOLD_MET' }
  | { type: 'UPDATE' }
  | { type: 'EXCEED' }
  | { type: 'DROP_BELOW' };

export function quorumGaugeReducer(state: QuorumGaugeState, event: QuorumGaugeEvent): QuorumGaugeState {
  switch (state) {
    case 'belowThreshold':
      if (event.type === 'THRESHOLD_MET') return 'atThreshold';
      if (event.type === 'UPDATE') return 'belowThreshold';
      return state;
    case 'atThreshold':
      if (event.type === 'EXCEED') return 'aboveThreshold';
      if (event.type === 'DROP_BELOW') return 'belowThreshold';
      return state;
    case 'aboveThreshold':
      if (event.type === 'DROP_BELOW') return 'belowThreshold';
      if (event.type === 'UPDATE') return 'aboveThreshold';
      return state;
    default:
      return state;
  }
}

export interface QuorumGaugeProps { [key: string]: unknown; className?: string; }
export interface QuorumGaugeOptions { target: HTMLElement; props: QuorumGaugeProps; }

let _quorumGaugeUid = 0;

export class QuorumGauge {
  private el: HTMLElement;
  private props: QuorumGaugeProps;
  private state: QuorumGaugeState = 'belowThreshold';

  constructor(options: QuorumGaugeOptions) {
    this.props = { ...options.props };
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'quorum-gauge');
    this.el.setAttribute('data-part', 'root');
    this.el.setAttribute('role', 'progressbar');
    this.el.setAttribute('tabindex', '0');
    this.el.id = 'quorum-gauge-' + (++_quorumGaugeUid);
    this.render();
    options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  send(type: string): void {
    this.state = quorumGaugeReducer(this.state, { type } as any);
    this.el.setAttribute('data-state', this.state);
  }

  update(props: Partial<QuorumGaugeProps>): void {
    Object.assign(this.props, props);
    this.el.innerHTML = '';
    this.render();
  }

  destroy(): void { this.el.remove(); }

  private render(): void {
    this.el.setAttribute('data-state', this.state);
    if (this.props.className) this.el.className = this.props.className as string;
    const progressBar = document.createElement('div');
    progressBar.setAttribute('data-part', 'progress-bar');
    this.el.appendChild(progressBar);
    const fill = document.createElement('div');
    fill.setAttribute('data-part', 'fill');
    this.el.appendChild(fill);
    const thresholdMarker = document.createElement('div');
    thresholdMarker.setAttribute('data-part', 'threshold-marker');
    this.el.appendChild(thresholdMarker);
    const currentLabel = document.createElement('span');
    currentLabel.setAttribute('data-part', 'current-label');
    this.el.appendChild(currentLabel);
    const thresholdLabel = document.createElement('span');
    thresholdLabel.setAttribute('data-part', 'threshold-label');
    this.el.appendChild(thresholdLabel);
    const statusBadge = document.createElement('div');
    statusBadge.setAttribute('data-part', 'status-badge');
    this.el.appendChild(statusBadge);
  }
}

export default QuorumGauge;
