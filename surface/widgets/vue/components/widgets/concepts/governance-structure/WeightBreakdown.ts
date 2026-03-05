import { defineComponent, h, ref, computed } from 'vue';

/* ---------------------------------------------------------------------------
 * WeightBreakdown state machine
 * ------------------------------------------------------------------------- */

export type WeightBreakdownState = 'idle' | 'segmentHovered';
export type WeightBreakdownEvent =
  | { type: 'HOVER_SEGMENT'; source: string }
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

/* ---------------------------------------------------------------------------
 * Types & Helpers
 * ------------------------------------------------------------------------- */

export type WeightSourceType = 'token' | 'delegation' | 'reputation' | 'manual';

export interface WeightSource { label: string; weight: number; type: WeightSourceType; }

const SOURCE_COLORS: Record<WeightSourceType, string> = {
  token: 'var(--weight-token, #3b82f6)', delegation: 'var(--weight-delegation, #8b5cf6)',
  reputation: 'var(--weight-reputation, #10b981)', manual: 'var(--weight-manual, #f59e0b)',
};

function prepareSegments(sources: WeightSource[], totalWeight: number) {
  const sorted = [...sources].sort((a, b) => b.weight - a.weight);
  return sorted.map((s) => ({ ...s, percent: totalWeight > 0 ? (s.weight / totalWeight) * 100 : 0 }));
}

function formatWeight(value: number): string { return Number(value.toFixed(2)).toString(); }

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export const WeightBreakdown = defineComponent({
  name: 'WeightBreakdown',
  props: {
    sources: { type: Array as () => WeightSource[], required: true },
    totalWeight: { type: Number, required: true },
    participant: { type: String, required: true },
    variant: { type: String, default: 'bar' },
    showLegend: { type: Boolean, default: true },
    showTotal: { type: Boolean, default: true },
  },
  setup(props, { slots }) {
    const state = ref<WeightBreakdownState>('idle');
    const send = (event: WeightBreakdownEvent) => { state.value = weightBreakdownReducer(state.value, event); };

    const hoveredSource = ref<string | null>(null);
    const focusedIndex = ref(-1);

    const segments = computed(() => prepareSegments(props.sources, props.totalWeight));

    const handleSegmentEnter = (label: string) => { hoveredSource.value = label; send({ type: 'HOVER_SEGMENT', source: label }); };
    const handleSegmentLeave = () => { hoveredSource.value = null; send({ type: 'LEAVE' }); };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (segments.value.length === 0) return;
      let nextIndex = focusedIndex.value;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        nextIndex = focusedIndex.value < segments.value.length - 1 ? focusedIndex.value + 1 : 0;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        nextIndex = focusedIndex.value > 0 ? focusedIndex.value - 1 : segments.value.length - 1;
      }
      if (nextIndex !== focusedIndex.value) {
        focusedIndex.value = nextIndex;
        hoveredSource.value = segments.value[nextIndex].label;
        send({ type: 'HOVER_SEGMENT', source: segments.value[nextIndex].label });
      }
    };

    const donutSegments = computed(() => {
      if (props.variant !== 'donut') return [];
      let cumulativeAngle = -90;
      return segments.value.map((seg) => {
        const angle = (seg.percent / 100) * 360;
        const startAngle = cumulativeAngle;
        const endAngle = cumulativeAngle + angle;
        cumulativeAngle = endAngle;
        const r = 40; const cx = 50; const cy = 50;
        const largeArc = angle > 180 ? 1 : 0;
        const startRad = (startAngle * Math.PI) / 180;
        const endRad = (endAngle * Math.PI) / 180;
        const x1 = cx + r * Math.cos(startRad); const y1 = cy + r * Math.sin(startRad);
        const x2 = cx + r * Math.cos(endRad); const y2 = cy + r * Math.sin(endRad);
        const d = angle >= 360
          ? `M ${cx - r},${cy} A ${r},${r} 0 1,1 ${cx + r},${cy} A ${r},${r} 0 1,1 ${cx - r},${cy}`
          : `M ${cx},${cy} L ${x1},${y1} A ${r},${r} 0 ${largeArc},1 ${x2},${y2} Z`;
        return { ...seg, d };
      });
    });

    const tooltipSegment = computed(() => hoveredSource.value ? segments.value.find((s) => s.label === hoveredSource.value) : null);

    return () => h('div', {
      role: 'img', 'aria-label': `Weight breakdown for ${props.participant}: ${formatWeight(props.totalWeight)} total`,
      'data-surface-widget': '', 'data-widget-name': 'weight-breakdown',
      'data-part': 'root', 'data-state': state.value, 'data-variant': props.variant,
      tabindex: 0, onKeydown: handleKeyDown,
    }, [
      // Total
      props.showTotal ? h('span', { 'data-part': 'total', 'data-visible': 'true', 'aria-label': `Total weight: ${formatWeight(props.totalWeight)}` }, formatWeight(props.totalWeight)) : null,
      // Chart
      h('div', { 'data-part': 'chart' },
        props.variant === 'bar'
          ? segments.value.map((seg, i) => h('div', {
              key: seg.label, 'data-part': 'segment', 'data-source': seg.type,
              'data-highlighted': hoveredSource.value === seg.label ? 'true' : 'false',
              role: 'img', 'aria-label': `${seg.label}: ${formatWeight(seg.weight)} (${formatWeight(seg.percent)}%)`,
              tabindex: -1,
              style: { width: `${seg.percent}%`, backgroundColor: SOURCE_COLORS[seg.type], display: 'inline-block', height: '100%', opacity: hoveredSource.value && hoveredSource.value !== seg.label ? 0.5 : 1, transition: 'opacity 150ms ease' },
              onMouseenter: () => handleSegmentEnter(seg.label),
              onMouseleave: handleSegmentLeave,
              onFocus: () => { focusedIndex.value = i; handleSegmentEnter(seg.label); },
              onBlur: handleSegmentLeave,
            }))
          : [h('svg', { viewBox: '0 0 100 100', role: 'presentation', style: { width: '100%', height: '100%' } }, [
              ...donutSegments.value.map((seg, i) => h('path', {
                key: seg.label, d: seg.d, fill: SOURCE_COLORS[seg.type],
                'data-part': 'segment', 'data-source': seg.type,
                'data-highlighted': hoveredSource.value === seg.label ? 'true' : 'false',
                role: 'img', 'aria-label': `${seg.label}: ${formatWeight(seg.weight)} (${formatWeight(seg.percent)}%)`,
                tabindex: -1, opacity: hoveredSource.value && hoveredSource.value !== seg.label ? 0.5 : 1,
                style: { transition: 'opacity 150ms ease', cursor: 'pointer' },
                onMouseenter: () => handleSegmentEnter(seg.label),
                onMouseleave: handleSegmentLeave,
                onFocus: () => { focusedIndex.value = i; handleSegmentEnter(seg.label); },
                onBlur: handleSegmentLeave,
              })),
              props.showTotal ? h('text', { x: '50', y: '50', 'text-anchor': 'middle', 'dominant-baseline': 'central', 'data-part': 'donut-center', style: { fontSize: '8px', fontWeight: 'bold' } }, formatWeight(props.totalWeight)) : null,
            ])],
      ),
      // Legend
      props.showLegend ? h('div', { 'data-part': 'legend', 'data-visible': 'true' }, segments.value.map((seg) =>
        h('div', { key: seg.label, 'data-part': 'legend-item', 'data-source': seg.type, 'aria-label': `${seg.label}: ${formatWeight(seg.percent)}%` }, [
          h('span', { 'data-part': 'legend-swatch', 'aria-hidden': 'true', style: { display: 'inline-block', width: '12px', height: '12px', borderRadius: '2px', backgroundColor: SOURCE_COLORS[seg.type], marginRight: '4px' } }),
          h('span', { 'data-part': 'legend-label' }, seg.label),
          h('span', { 'data-part': 'legend-percent' }, ` ${formatWeight(seg.percent)}%`),
          h('span', { 'data-part': 'legend-value' }, ` (${formatWeight(seg.weight)})`),
        ]),
      )) : null,
      // Tooltip
      h('div', {
        'data-part': 'tooltip', role: 'tooltip',
        'data-visible': state.value === 'segmentHovered' ? 'true' : 'false',
        'aria-hidden': state.value !== 'segmentHovered',
        style: { visibility: state.value === 'segmentHovered' ? 'visible' : 'hidden', position: 'absolute' },
      }, tooltipSegment.value ? [
        h('span', { 'data-part': 'tooltip-label' }, tooltipSegment.value.label),
        h('span', { 'data-part': 'tooltip-type' }, tooltipSegment.value.type),
        h('span', { 'data-part': 'tooltip-value' }, formatWeight(tooltipSegment.value.weight)),
        h('span', { 'data-part': 'tooltip-percent' }, `${formatWeight(tooltipSegment.value.percent)}%`),
      ] : []),
      slots.default ? slots.default() : null,
    ]);
  },
});

export default WeightBreakdown;
