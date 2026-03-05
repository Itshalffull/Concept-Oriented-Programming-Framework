import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

export type VoteResultBarState = 'idle' | 'animating' | 'segmentHovered';
export type VoteResultBarEvent =
  | { type: 'HOVER_SEGMENT' }
  | { type: 'ANIMATE_IN' }
  | { type: 'ANIMATION_END' }
  | { type: 'UNHOVER' };

export function voteResultBarReducer(state: VoteResultBarState, event: VoteResultBarEvent): VoteResultBarState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER_SEGMENT') return 'segmentHovered';
      if (event.type === 'ANIMATE_IN') return 'animating';
      return state;
    case 'animating':
      if (event.type === 'ANIMATION_END') return 'idle';
      return state;
    case 'segmentHovered':
      if (event.type === 'UNHOVER') return 'idle';
      return state;
    default:
      return state;
  }
}

export interface VoteResultBarProps { [key: string]: unknown; class?: string; }
export interface VoteResultBarResult { element: HTMLElement; dispose: () => void; }

export function VoteResultBar(props: VoteResultBarProps): VoteResultBarResult {
  const sig = surfaceCreateSignal<VoteResultBarState>('idle');
  const state = () => sig.get();
  const send = (type: string) => sig.set(voteResultBarReducer(sig.get(), { type } as any));
  const unsubs: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'vote-result-bar');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'img');
  root.setAttribute('aria-label', 'Vote results');
  root.setAttribute('aria-roledescription', 'vote result bar');
  root.setAttribute('data-state', state());
  root.setAttribute('data-variant', 'binary');
  root.setAttribute('data-size', 'md');
  root.setAttribute('tabindex', '0');
  root.style.position = 'relative';
  if (props.class) root.className = props.class as string;

  /* Bar container */
  const barEl = document.createElement('div');
  barEl.setAttribute('data-part', 'bar');
  barEl.setAttribute('data-state', state());
  barEl.style.display = 'flex';
  barEl.style.width = '100%';
  barEl.style.height = '24px';
  barEl.style.borderRadius = '4px';
  barEl.style.overflow = 'hidden';
  barEl.style.position = 'relative';
  barEl.style.backgroundColor = '#e0e0e0';
  root.appendChild(barEl);

  /* Segment template */
  const segmentEl = document.createElement('div');
  segmentEl.setAttribute('data-part', 'segment');
  segmentEl.setAttribute('data-state', state());
  segmentEl.setAttribute('role', 'img');
  segmentEl.setAttribute('tabindex', '-1');
  segmentEl.style.cursor = 'pointer';
  segmentEl.style.position = 'relative';
  segmentEl.style.transition = 'width 0.4s ease-out, opacity 0.2s ease';
  segmentEl.addEventListener('mouseenter', () => send('HOVER_SEGMENT'));
  segmentEl.addEventListener('mouseleave', () => send('UNHOVER'));
  barEl.appendChild(segmentEl);

  /* Quorum marker */
  const quorumMarkerEl = document.createElement('div');
  quorumMarkerEl.setAttribute('data-part', 'quorum-marker');
  quorumMarkerEl.setAttribute('data-state', state());
  quorumMarkerEl.setAttribute('data-visible', 'true');
  quorumMarkerEl.setAttribute('role', 'img');
  quorumMarkerEl.style.position = 'absolute';
  quorumMarkerEl.style.top = '0';
  quorumMarkerEl.style.bottom = '0';
  quorumMarkerEl.style.width = '2px';
  quorumMarkerEl.style.backgroundColor = '#000';
  quorumMarkerEl.style.zIndex = '5';
  quorumMarkerEl.style.pointerEvents = 'none';
  barEl.appendChild(quorumMarkerEl);

  /* Segment labels area */
  const labelsEl = document.createElement('div');
  labelsEl.style.display = 'flex';
  labelsEl.style.justifyContent = 'space-between';
  labelsEl.style.marginTop = '4px';
  labelsEl.style.flexWrap = 'wrap';
  labelsEl.style.gap = '4px 12px';

  const segmentLabelEl = document.createElement('span');
  segmentLabelEl.setAttribute('data-part', 'segment-label');
  segmentLabelEl.setAttribute('data-state', state());
  segmentLabelEl.setAttribute('data-visible', 'true');
  segmentLabelEl.style.fontSize = '12px';
  segmentLabelEl.style.color = '#555';
  segmentLabelEl.style.display = 'inline-flex';
  segmentLabelEl.style.alignItems = 'center';
  segmentLabelEl.style.gap = '4px';
  labelsEl.appendChild(segmentLabelEl);
  root.appendChild(labelsEl);

  /* Total label */
  const totalLabelEl = document.createElement('span');
  totalLabelEl.setAttribute('data-part', 'total-label');
  totalLabelEl.setAttribute('data-state', state());
  totalLabelEl.style.display = 'block';
  totalLabelEl.style.marginTop = '4px';
  totalLabelEl.style.fontSize = '12px';
  totalLabelEl.style.color = '#777';
  root.appendChild(totalLabelEl);

  /* Keyboard navigation */
  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      send('HOVER_SEGMENT');
    } else if (e.key === 'Escape') {
      send('UNHOVER');
    }
  });

  /* Animate in on mount */
  send('ANIMATE_IN');
  requestAnimationFrame(() => {
    setTimeout(() => send('ANIMATION_END'), 400);
  });

  /* Subscribe to state changes */
  unsubs.push(sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    barEl.setAttribute('data-state', s);
    segmentEl.setAttribute('data-state', s);
    segmentLabelEl.setAttribute('data-state', s);
    totalLabelEl.setAttribute('data-state', s);
    quorumMarkerEl.setAttribute('data-state', s);
  }));

  return {
    element: root,
    dispose() { unsubs.forEach((u) => u()); root.remove(); },
  };
}

export default VoteResultBar;
