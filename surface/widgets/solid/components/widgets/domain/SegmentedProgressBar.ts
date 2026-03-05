import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

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

export interface SegmentedProgressBarProps { [key: string]: unknown; class?: string; }
export interface SegmentedProgressBarResult { element: HTMLElement; dispose: () => void; }

export function SegmentedProgressBar(props: SegmentedProgressBarProps): SegmentedProgressBarResult {
  const sig = surfaceCreateSignal<SegmentedProgressBarState>('idle');
  const state = () => sig.get();
  const send = (type: string) => sig.set(segmentedProgressBarReducer(sig.get(), { type } as any));

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'segmented-progress-bar');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'img');
  root.setAttribute('data-state', state());
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  const barEl = document.createElement('div');
  barEl.setAttribute('data-part', 'bar');
  root.appendChild(barEl);
  const segmentEl = document.createElement('div');
  segmentEl.setAttribute('data-part', 'segment');
  root.appendChild(segmentEl);
  const segmentLabelEl = document.createElement('span');
  segmentLabelEl.setAttribute('data-part', 'segment-label');
  root.appendChild(segmentLabelEl);
  const legendEl = document.createElement('div');
  legendEl.setAttribute('data-part', 'legend');
  root.appendChild(legendEl);
  const totalLabelEl = document.createElement('span');
  totalLabelEl.setAttribute('data-part', 'total-label');
  root.appendChild(totalLabelEl);

  const unsub = sig.subscribe((s) => { root.setAttribute('data-state', s); });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default SegmentedProgressBar;
