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

type WeightSourceType = 'token' | 'delegation' | 'reputation' | 'manual';
interface WeightSource { label: string; weight: number; type: WeightSourceType; }

const SOURCE_COLORS: Record<WeightSourceType, string> = {
  token: 'var(--weight-token, #3b82f6)',
  delegation: 'var(--weight-delegation, #8b5cf6)',
  reputation: 'var(--weight-reputation, #10b981)',
  manual: 'var(--weight-manual, #f59e0b)',
};

function formatWeight(value: number): string {
  return Number(value.toFixed(2)).toString();
}

export interface WeightBreakdownProps { [key: string]: unknown; class?: string; }
export interface WeightBreakdownResult { element: HTMLElement; dispose: () => void; }

export function WeightBreakdown(props: WeightBreakdownProps): WeightBreakdownResult {
  const sig = surfaceCreateSignal<WeightBreakdownState>('idle');
  const send = (type: string) => sig.set(weightBreakdownReducer(sig.get(), { type } as any));

  const sources = (props.sources ?? []) as WeightSource[];
  const totalWeight = typeof props.totalWeight === 'number' ? props.totalWeight : 0;
  const participant = String(props.participant ?? '');
  const variant = String(props.variant ?? 'bar') as 'bar' | 'donut';
  const showLegend = props.showLegend !== false;
  const showTotal = props.showTotal !== false;

  const sorted = [...sources].sort((a, b) => b.weight - a.weight);
  const segments = sorted.map((s) => ({
    ...s,
    percent: totalWeight > 0 ? (s.weight / totalWeight) * 100 : 0,
  }));

  let hoveredSource: string | null = null;
  let focusedIndex = -1;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'weight-breakdown');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'img');
  root.setAttribute('aria-label', `Weight breakdown for ${participant}: ${formatWeight(totalWeight)} total`);
  root.setAttribute('data-state', sig.get());
  root.setAttribute('data-variant', variant);
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  /* Total */
  if (showTotal) {
    const totalEl = document.createElement('span');
    totalEl.setAttribute('data-part', 'total');
    totalEl.setAttribute('data-visible', 'true');
    totalEl.setAttribute('aria-label', `Total weight: ${formatWeight(totalWeight)}`);
    totalEl.textContent = formatWeight(totalWeight);
    root.appendChild(totalEl);
  }

  /* Chart */
  const chartEl = document.createElement('div');
  chartEl.setAttribute('data-part', 'chart');
  root.appendChild(chartEl);

  const segmentEls: HTMLDivElement[] = [];
  if (variant === 'bar') {
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const segEl = document.createElement('div');
      segEl.setAttribute('data-part', 'segment');
      segEl.setAttribute('data-source', seg.type);
      segEl.setAttribute('data-highlighted', 'false');
      segEl.setAttribute('role', 'img');
      segEl.setAttribute('aria-label', `${seg.label}: ${formatWeight(seg.weight)} (${formatWeight(seg.percent)}%)`);
      segEl.setAttribute('tabindex', '-1');
      segEl.style.width = `${seg.percent}%`;
      segEl.style.backgroundColor = SOURCE_COLORS[seg.type];
      segEl.style.display = 'inline-block';
      segEl.style.height = '100%';
      segEl.style.transition = 'opacity 150ms ease';

      const idx = i;
      segEl.addEventListener('mouseenter', () => handleEnter(seg.label));
      segEl.addEventListener('mouseleave', handleLeave);
      segEl.addEventListener('focus', () => { focusedIndex = idx; handleEnter(seg.label); });
      segEl.addEventListener('blur', handleLeave);

      chartEl.appendChild(segEl);
      segmentEls.push(segEl);
    }
  }

  /* Legend */
  if (showLegend) {
    const legendEl = document.createElement('div');
    legendEl.setAttribute('data-part', 'legend');
    legendEl.setAttribute('data-visible', 'true');
    for (const seg of segments) {
      const item = document.createElement('div');
      item.setAttribute('data-part', 'legend-item');
      item.setAttribute('data-source', seg.type);
      item.setAttribute('aria-label', `${seg.label}: ${formatWeight(seg.percent)}%`);

      const swatch = document.createElement('span');
      swatch.setAttribute('data-part', 'legend-swatch');
      swatch.setAttribute('aria-hidden', 'true');
      swatch.style.display = 'inline-block';
      swatch.style.width = '12px';
      swatch.style.height = '12px';
      swatch.style.borderRadius = '2px';
      swatch.style.backgroundColor = SOURCE_COLORS[seg.type];
      swatch.style.marginRight = '4px';
      item.appendChild(swatch);

      const labelSpan = document.createElement('span');
      labelSpan.setAttribute('data-part', 'legend-label');
      labelSpan.textContent = seg.label;
      item.appendChild(labelSpan);

      const pctSpan = document.createElement('span');
      pctSpan.setAttribute('data-part', 'legend-percent');
      pctSpan.textContent = ` ${formatWeight(seg.percent)}%`;
      item.appendChild(pctSpan);

      const valSpan = document.createElement('span');
      valSpan.setAttribute('data-part', 'legend-value');
      valSpan.textContent = ` (${formatWeight(seg.weight)})`;
      item.appendChild(valSpan);

      legendEl.appendChild(item);
    }
    root.appendChild(legendEl);
  }

  /* Tooltip */
  const tooltipEl = document.createElement('div');
  tooltipEl.setAttribute('data-part', 'tooltip');
  tooltipEl.setAttribute('role', 'tooltip');
  tooltipEl.setAttribute('data-visible', 'false');
  tooltipEl.setAttribute('aria-hidden', 'true');
  tooltipEl.style.visibility = 'hidden';
  tooltipEl.style.position = 'absolute';
  root.appendChild(tooltipEl);

  function handleEnter(label: string): void {
    hoveredSource = label;
    send('HOVER_SEGMENT');
    updateOpacity();
    updateTooltip();
  }

  function handleLeave(): void {
    hoveredSource = null;
    send('LEAVE');
    updateOpacity();
    updateTooltip();
  }

  function updateOpacity(): void {
    for (let i = 0; i < segmentEls.length; i++) {
      segmentEls[i].style.opacity = hoveredSource && segments[i].label !== hoveredSource ? '0.5' : '1';
      segmentEls[i].setAttribute('data-highlighted', segments[i].label === hoveredSource ? 'true' : 'false');
    }
  }

  function updateTooltip(): void {
    if (sig.get() === 'segmentHovered' && hoveredSource) {
      const seg = segments.find((s) => s.label === hoveredSource);
      if (seg) {
        tooltipEl.innerHTML = '';
        tooltipEl.setAttribute('data-visible', 'true');
        tooltipEl.setAttribute('aria-hidden', 'false');
        tooltipEl.style.visibility = 'visible';
        const addSpan = (part: string, text: string) => {
          const sp = document.createElement('span');
          sp.setAttribute('data-part', part);
          sp.textContent = text;
          tooltipEl.appendChild(sp);
        };
        addSpan('tooltip-label', seg.label);
        addSpan('tooltip-type', seg.type);
        addSpan('tooltip-value', formatWeight(seg.weight));
        addSpan('tooltip-percent', `${formatWeight(seg.percent)}%`);
      }
    } else {
      tooltipEl.setAttribute('data-visible', 'false');
      tooltipEl.setAttribute('aria-hidden', 'true');
      tooltipEl.style.visibility = 'hidden';
    }
  }

  root.addEventListener('keydown', (e) => {
    if (segments.length === 0) return;
    let nextIndex = focusedIndex;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextIndex = focusedIndex < segments.length - 1 ? focusedIndex + 1 : 0;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      nextIndex = focusedIndex > 0 ? focusedIndex - 1 : segments.length - 1;
    }
    if (nextIndex !== focusedIndex) {
      focusedIndex = nextIndex;
      hoveredSource = segments[nextIndex].label;
      send('HOVER_SEGMENT');
      segmentEls[nextIndex]?.focus();
      updateOpacity();
      updateTooltip();
    }
  });

  const unsub = sig.subscribe((s) => { root.setAttribute('data-state', s); });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default WeightBreakdown;
