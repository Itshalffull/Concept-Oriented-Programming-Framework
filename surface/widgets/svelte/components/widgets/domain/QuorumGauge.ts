import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

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

export interface QuorumGaugeProps { [key: string]: unknown; class?: string; }
export interface QuorumGaugeResult { element: HTMLElement; dispose: () => void; }

export function QuorumGauge(props: QuorumGaugeProps): QuorumGaugeResult {
  const sig = surfaceCreateSignal<QuorumGaugeState>('belowThreshold');
  const state = () => sig.get();
  const send = (type: string) => sig.set(quorumGaugeReducer(sig.get(), { type } as any));

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'quorum-gauge');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'progressbar');
  root.setAttribute('data-state', state());
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  const progressBarEl = document.createElement('div');
  progressBarEl.setAttribute('data-part', 'progress-bar');
  root.appendChild(progressBarEl);
  const fillEl = document.createElement('div');
  fillEl.setAttribute('data-part', 'fill');
  root.appendChild(fillEl);
  const thresholdMarkerEl = document.createElement('div');
  thresholdMarkerEl.setAttribute('data-part', 'threshold-marker');
  root.appendChild(thresholdMarkerEl);
  const currentLabelEl = document.createElement('span');
  currentLabelEl.setAttribute('data-part', 'current-label');
  root.appendChild(currentLabelEl);
  const thresholdLabelEl = document.createElement('span');
  thresholdLabelEl.setAttribute('data-part', 'threshold-label');
  root.appendChild(thresholdLabelEl);
  const statusBadgeEl = document.createElement('div');
  statusBadgeEl.setAttribute('data-part', 'status-badge');
  root.appendChild(statusBadgeEl);

  const unsub = sig.subscribe((s) => { root.setAttribute('data-state', s); });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default QuorumGauge;
