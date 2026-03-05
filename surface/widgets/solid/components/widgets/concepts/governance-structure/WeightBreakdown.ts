import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

export type WeightBreakdownState = 'idle' | 'segmentHovered';
export type WeightBreakdownEvent =
  | { type: 'HOVER_SEGMENT' }
  | { type: 'LEAVE' };

export function weightBreakdownReducer(state: WeightBreakdownState, event: WeightBreakdownEvent): WeightBreakdownState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER_SEGMENT') return 'segmentHovered';
      return state;
    case 'segmentHovered':
      if (event.type === 'LEAVE') return 'idle';
      return state;
    default:
      return state;
  }
}

export interface WeightBreakdownProps { [key: string]: unknown; class?: string; }
export interface WeightBreakdownResult { element: HTMLElement; dispose: () => void; }

export function WeightBreakdown(props: WeightBreakdownProps): WeightBreakdownResult {
  const sig = surfaceCreateSignal<WeightBreakdownState>('idle');
  const state = () => sig.get();
  const send = (type: string) => sig.set(weightBreakdownReducer(sig.get(), { type } as any));
  const unsubs: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'weight-breakdown');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'img');
  root.setAttribute('data-state', state());
  root.setAttribute('data-variant', 'bar');
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  /* Total display */
  const totalEl = document.createElement('span');
  totalEl.setAttribute('data-part', 'total');
  totalEl.setAttribute('data-visible', 'true');
  root.appendChild(totalEl);

  /* Chart area */
  const chartEl = document.createElement('div');
  chartEl.setAttribute('data-part', 'chart');

  /* Segment template */
  const segmentEl = document.createElement('div');
  segmentEl.setAttribute('data-part', 'segment');
  segmentEl.setAttribute('data-highlighted', 'false');
  segmentEl.setAttribute('role', 'img');
  segmentEl.setAttribute('tabindex', '-1');
  segmentEl.style.display = 'inline-block';
  segmentEl.style.height = '100%';
  segmentEl.style.transition = 'opacity 150ms ease';
  segmentEl.addEventListener('mouseenter', () => send('HOVER_SEGMENT'));
  segmentEl.addEventListener('mouseleave', () => send('LEAVE'));
  segmentEl.addEventListener('focus', () => send('HOVER_SEGMENT'));
  segmentEl.addEventListener('blur', () => send('LEAVE'));
  chartEl.appendChild(segmentEl);

  root.appendChild(chartEl);

  /* Legend */
  const legendEl = document.createElement('div');
  legendEl.setAttribute('data-part', 'legend');
  legendEl.setAttribute('data-visible', 'true');

  const legendItemEl = document.createElement('div');
  legendItemEl.setAttribute('data-part', 'legend-item');

  const legendSwatchEl = document.createElement('span');
  legendSwatchEl.setAttribute('data-part', 'legend-swatch');
  legendSwatchEl.setAttribute('aria-hidden', 'true');
  legendSwatchEl.style.display = 'inline-block';
  legendSwatchEl.style.width = '12px';
  legendSwatchEl.style.height = '12px';
  legendSwatchEl.style.borderRadius = '2px';
  legendSwatchEl.style.marginRight = '4px';
  legendItemEl.appendChild(legendSwatchEl);

  const legendLabelEl = document.createElement('span');
  legendLabelEl.setAttribute('data-part', 'legend-label');
  legendItemEl.appendChild(legendLabelEl);

  const legendPercentEl = document.createElement('span');
  legendPercentEl.setAttribute('data-part', 'legend-percent');
  legendItemEl.appendChild(legendPercentEl);

  const legendValueEl = document.createElement('span');
  legendValueEl.setAttribute('data-part', 'legend-value');
  legendItemEl.appendChild(legendValueEl);

  legendEl.appendChild(legendItemEl);
  root.appendChild(legendEl);

  /* Tooltip */
  const tooltipEl = document.createElement('div');
  tooltipEl.setAttribute('data-part', 'tooltip');
  tooltipEl.setAttribute('role', 'tooltip');
  tooltipEl.setAttribute('data-visible', 'false');
  tooltipEl.setAttribute('aria-hidden', 'true');
  tooltipEl.style.visibility = 'hidden';
  tooltipEl.style.position = 'absolute';

  const tooltipLabelEl = document.createElement('span');
  tooltipLabelEl.setAttribute('data-part', 'tooltip-label');
  tooltipEl.appendChild(tooltipLabelEl);

  const tooltipTypeEl = document.createElement('span');
  tooltipTypeEl.setAttribute('data-part', 'tooltip-type');
  tooltipEl.appendChild(tooltipTypeEl);

  const tooltipValueEl = document.createElement('span');
  tooltipValueEl.setAttribute('data-part', 'tooltip-value');
  tooltipEl.appendChild(tooltipValueEl);

  const tooltipPercentEl = document.createElement('span');
  tooltipPercentEl.setAttribute('data-part', 'tooltip-percent');
  tooltipEl.appendChild(tooltipPercentEl);

  root.appendChild(tooltipEl);

  /* Keyboard navigation */
  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' ||
        e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      send('HOVER_SEGMENT');
    }
  });

  /* Subscribe to state changes */
  unsubs.push(sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    const isHovered = s === 'segmentHovered';
    tooltipEl.setAttribute('data-visible', isHovered ? 'true' : 'false');
    tooltipEl.setAttribute('aria-hidden', isHovered ? 'false' : 'true');
    tooltipEl.style.visibility = isHovered ? 'visible' : 'hidden';
  }));

  return {
    element: root,
    dispose() { unsubs.forEach((u) => u()); root.remove(); },
  };
}

export default WeightBreakdown;
