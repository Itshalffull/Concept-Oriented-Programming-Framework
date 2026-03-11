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
      if (event.type === 'HOVER_SEGMENT') return 'segmentHovered';
      return state;
    default:
      return state;
  }
}

/* --- Types & helpers --- */

interface VoteSegment {
  label: string;
  count: number;
  color?: string;
}

const DEFAULT_COLORS = ['#4caf50', '#f44336', '#ff9800', '#2196f3', '#9c27b0', '#00bcd4', '#795548', '#607d8b'];
const SIZE_MAP: Record<string, number> = { sm: 16, md: 24, lg: 36 };

function toPercent(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, (count / total) * 100));
}

function formatPercent(value: number): string {
  const formatted = value.toFixed(1);
  return formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted;
}

export interface VoteResultBarProps { [key: string]: unknown; class?: string; }
export interface VoteResultBarResult { element: HTMLElement; dispose: () => void; }

export function VoteResultBar(props: VoteResultBarProps): VoteResultBarResult {
  const sig = surfaceCreateSignal<VoteResultBarState>('idle');
  const state = () => sig.get();
  const send = (type: string) => sig.set(voteResultBarReducer(sig.get(), { type } as any));

  const segments = (props.segments ?? []) as VoteSegment[];
  const totalProp = props.total as number | undefined;
  const variant = String(props.variant ?? 'binary');
  const showLabels = props.showLabels !== false;
  const showQuorum = props.showQuorum === true;
  const quorumThreshold = typeof props.quorumThreshold === 'number' ? props.quorumThreshold : 0;
  const animate = props.animate !== false;
  const size = String(props.size ?? 'md') as 'sm' | 'md' | 'lg';
  const onSegmentHover = props.onSegmentHover as ((index: number | null, segment: VoteSegment | null) => void) | undefined;

  const total = (totalProp != null && totalProp > 0) ? totalProp : segments.reduce((sum, seg) => sum + seg.count, 0);
  const computedSegments = segments.map((seg, i) => ({
    ...seg,
    percent: toPercent(seg.count, total),
    resolvedColor: seg.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length],
  }));

  const ariaDescription = `Vote results: ${computedSegments.map(s => `${s.label}: ${s.count} votes (${formatPercent(s.percent)}%)`).join(', ')}. Total: ${total} votes.`;
  const barHeight = SIZE_MAP[size] ?? SIZE_MAP.md;

  let hoveredIndex: number | null = null;
  let focusedIndex = -1;
  let animated = !animate;
  let animationTimer: ReturnType<typeof setTimeout> | null = null;
  let frameId: number | null = null;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'vote-result-bar');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'img');
  root.setAttribute('aria-label', 'Vote results');
  root.setAttribute('aria-roledescription', 'vote result bar');
  root.setAttribute('aria-description', ariaDescription);
  root.setAttribute('data-state', state());
  root.setAttribute('data-variant', variant);
  root.setAttribute('data-size', size);
  root.setAttribute('tabindex', '0');
  root.style.position = 'relative';
  if (props.class) root.className = props.class as string;

  /* Bar container */
  const barEl = document.createElement('div');
  barEl.setAttribute('data-part', 'bar');
  barEl.setAttribute('data-state', state());
  barEl.setAttribute('data-total', String(total));
  barEl.style.display = 'flex';
  barEl.style.width = '100%';
  barEl.style.height = `${barHeight}px`;
  barEl.style.borderRadius = '4px';
  barEl.style.overflow = 'hidden';
  barEl.style.position = 'relative';
  barEl.style.backgroundColor = '#e0e0e0';
  root.appendChild(barEl);

  /* Segment elements */
  const segmentEls: HTMLDivElement[] = [];
  for (let i = 0; i < computedSegments.length; i++) {
    const seg = computedSegments[i];
    const segEl = document.createElement('div');
    segEl.setAttribute('data-part', 'segment');
    segEl.setAttribute('data-state', state());
    segEl.setAttribute('data-choice', seg.label);
    segEl.setAttribute('data-percent', formatPercent(seg.percent));
    segEl.setAttribute('data-color', seg.resolvedColor);
    segEl.setAttribute('role', 'img');
    segEl.setAttribute('aria-label', `${seg.label}: ${seg.count} votes (${formatPercent(seg.percent)}%)`);
    segEl.setAttribute('tabindex', '-1');

    const minWidth = seg.count === 0 && total > 0 ? '2px' : '';
    segEl.style.width = minWidth || `${animated ? seg.percent : 0}%`;
    if (minWidth) segEl.style.minWidth = minWidth;
    segEl.style.backgroundColor = seg.resolvedColor;
    if (animate) segEl.style.transition = 'width 0.4s ease-out, opacity 0.2s ease';
    segEl.style.position = 'relative';
    segEl.style.cursor = 'pointer';

    const idx = i;
    segEl.addEventListener('mouseenter', () => handleSegmentMouseEnter(idx));
    segEl.addEventListener('mouseleave', handleSegmentMouseLeave);
    segEl.addEventListener('focus', () => { focusedIndex = idx; handleSegmentMouseEnter(idx); });
    segEl.addEventListener('blur', () => { focusedIndex = -1; handleSegmentMouseLeave(); });

    barEl.appendChild(segEl);
    segmentEls.push(segEl);
  }

  /* Quorum marker */
  if (showQuorum && quorumThreshold > 0) {
    const markerEl = document.createElement('div');
    markerEl.setAttribute('data-part', 'quorum-marker');
    markerEl.setAttribute('data-state', state());
    markerEl.setAttribute('data-visible', 'true');
    markerEl.setAttribute('role', 'img');
    markerEl.setAttribute('aria-label', `Quorum threshold at ${quorumThreshold}%`);
    markerEl.style.position = 'absolute';
    markerEl.style.left = `${quorumThreshold}%`;
    markerEl.style.top = '0';
    markerEl.style.bottom = '0';
    markerEl.style.width = '2px';
    markerEl.style.backgroundColor = '#000';
    markerEl.style.zIndex = '5';
    markerEl.style.pointerEvents = 'none';
    barEl.appendChild(markerEl);
  }

  /* Labels */
  if (showLabels) {
    const labelsContainer = document.createElement('div');
    labelsContainer.style.display = 'flex';
    labelsContainer.style.justifyContent = 'space-between';
    labelsContainer.style.marginTop = '4px';
    labelsContainer.style.flexWrap = 'wrap';
    labelsContainer.style.gap = '4px 12px';

    for (const seg of computedSegments) {
      const labelEl = document.createElement('span');
      labelEl.setAttribute('data-part', 'segment-label');
      labelEl.setAttribute('data-state', state());
      labelEl.setAttribute('data-visible', 'true');
      labelEl.style.fontSize = size === 'sm' ? '11px' : size === 'lg' ? '14px' : '12px';
      labelEl.style.color = '#555';
      labelEl.style.display = 'inline-flex';
      labelEl.style.alignItems = 'center';
      labelEl.style.gap = '4px';

      const swatch = document.createElement('span');
      swatch.setAttribute('aria-hidden', 'true');
      swatch.style.display = 'inline-block';
      swatch.style.width = '8px';
      swatch.style.height = '8px';
      swatch.style.borderRadius = '50%';
      swatch.style.backgroundColor = seg.resolvedColor;
      labelEl.appendChild(swatch);

      labelEl.appendChild(document.createTextNode(` ${seg.label} ${seg.count} (${formatPercent(seg.percent)}%)`));
      labelsContainer.appendChild(labelEl);
    }
    root.appendChild(labelsContainer);
  }

  /* Total label */
  const totalLabelEl = document.createElement('span');
  totalLabelEl.setAttribute('data-part', 'total-label');
  totalLabelEl.setAttribute('data-state', state());
  totalLabelEl.setAttribute('aria-label', `Total votes: ${total}`);
  totalLabelEl.style.display = 'block';
  totalLabelEl.style.marginTop = '4px';
  totalLabelEl.style.fontSize = size === 'sm' ? '11px' : size === 'lg' ? '14px' : '12px';
  totalLabelEl.style.color = '#777';
  totalLabelEl.textContent = `Total: ${total}`;
  root.appendChild(totalLabelEl);

  /* Segment interaction */
  function handleSegmentMouseEnter(index: number): void {
    hoveredIndex = index;
    send('HOVER_SEGMENT');
    onSegmentHover?.(index, segments[index] ?? null);
    updateSegmentOpacity();
  }

  function handleSegmentMouseLeave(): void {
    hoveredIndex = null;
    send('UNHOVER');
    onSegmentHover?.(null, null);
    updateSegmentOpacity();
  }

  function updateSegmentOpacity(): void {
    for (let i = 0; i < segmentEls.length; i++) {
      segmentEls[i].style.opacity = hoveredIndex !== null && hoveredIndex !== i ? '0.5' : '1';
      segmentEls[i].style.outline = focusedIndex === i ? '2px solid #1a73e8' : '';
      segmentEls[i].style.outlineOffset = focusedIndex === i ? '-2px' : '';
    }
  }

  /* Keyboard navigation */
  root.addEventListener('keydown', (e) => {
    if (segments.length === 0) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const next = focusedIndex < segments.length - 1 ? focusedIndex + 1 : 0;
      focusedIndex = next;
      hoveredIndex = next;
      send('HOVER_SEGMENT');
      onSegmentHover?.(next, segments[next] ?? null);
      segmentEls[next]?.focus();
      updateSegmentOpacity();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prev = focusedIndex > 0 ? focusedIndex - 1 : segments.length - 1;
      focusedIndex = prev;
      hoveredIndex = prev;
      send('HOVER_SEGMENT');
      onSegmentHover?.(prev, segments[prev] ?? null);
      segmentEls[prev]?.focus();
      updateSegmentOpacity();
    } else if (e.key === 'Escape') {
      hoveredIndex = null;
      focusedIndex = -1;
      send('UNHOVER');
      onSegmentHover?.(null, null);
      updateSegmentOpacity();
    }
  });

  /* Animation on mount */
  if (animate) {
    const prefersReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      animated = true;
      for (let i = 0; i < segmentEls.length; i++) {
        const seg = computedSegments[i];
        const minW = seg.count === 0 && total > 0 ? '2px' : '';
        segmentEls[i].style.width = minW || `${seg.percent}%`;
      }
    } else {
      send('ANIMATE_IN');
      frameId = requestAnimationFrame(() => {
        animated = true;
        for (let i = 0; i < segmentEls.length; i++) {
          const seg = computedSegments[i];
          const minW = seg.count === 0 && total > 0 ? '2px' : '';
          segmentEls[i].style.width = minW || `${seg.percent}%`;
        }
        animationTimer = setTimeout(() => send('ANIMATION_END'), 400);
      });
    }
  }

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    barEl.setAttribute('data-state', s);
  });

  return {
    element: root,
    dispose() {
      unsub();
      if (animationTimer) clearTimeout(animationTimer);
      if (frameId) cancelAnimationFrame(frameId);
      root.remove();
    },
  };
}

export default VoteResultBar;
