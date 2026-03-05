import { defineComponent, h, ref, computed, onMounted, onUnmounted } from 'vue';

/* ---------------------------------------------------------------------------
 * VoteResultBar state machine
 * States: idle (initial), animating, segmentHovered
 * ------------------------------------------------------------------------- */

export type VoteResultBarState = 'idle' | 'animating' | 'segmentHovered';
export type VoteResultBarEvent =
  | { type: 'HOVER_SEGMENT'; index: number }
  | { type: 'ANIMATE_IN' }
  | { type: 'ANIMATION_END' }
  | { type: 'UNHOVER' }
  | { type: 'FOCUS_NEXT_SEGMENT' }
  | { type: 'FOCUS_PREV_SEGMENT' };

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

/* ---------------------------------------------------------------------------
 * Types & Helpers
 * ------------------------------------------------------------------------- */

export interface VoteSegment {
  label: string;
  count: number;
  color?: string;
}

const DEFAULT_COLORS = [
  '#4caf50', '#f44336', '#ff9800', '#2196f3',
  '#9c27b0', '#00bcd4', '#795548', '#607d8b',
];

function toPercent(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, (count / total) * 100));
}

function formatPercent(value: number): string {
  const formatted = value.toFixed(1);
  return formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted;
}

const SIZE_MAP: Record<string, number> = { sm: 16, md: 24, lg: 36 };

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export const VoteResultBar = defineComponent({
  name: 'VoteResultBar',
  props: {
    segments: { type: Array as () => VoteSegment[], required: true },
    total: { type: Number, default: undefined },
    variant: { type: String, default: 'binary' },
    showLabels: { type: Boolean, default: true },
    showQuorum: { type: Boolean, default: false },
    quorumThreshold: { type: Number, default: 0 },
    animate: { type: Boolean, default: true },
    size: { type: String, default: 'md' },
  },
  emits: ['segmentHover'],
  setup(props, { slots, emit }) {
    const state = ref<VoteResultBarState>('idle');
    const send = (event: VoteResultBarEvent) => {
      state.value = voteResultBarReducer(state.value, event);
    };

    const hoveredIndex = ref<number | null>(null);
    const focusedIndex = ref<number>(-1);
    const animated = ref(!props.animate);

    const total = computed(() => {
      if (props.total != null && props.total > 0) return props.total;
      return props.segments.reduce((sum, seg) => sum + seg.count, 0);
    });

    const computedSegments = computed(() =>
      props.segments.map((seg, i) => ({
        ...seg,
        percent: toPercent(seg.count, total.value),
        resolvedColor: seg.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length],
      })),
    );

    const ariaDescription = computed(() => {
      const parts = computedSegments.value.map(
        (seg) => `${seg.label}: ${seg.count} votes (${formatPercent(seg.percent)}%)`,
      );
      return `Vote results: ${parts.join(', ')}. Total: ${total.value} votes.`;
    });

    let animationTimer: ReturnType<typeof setTimeout> | null = null;
    let frameId: number | null = null;

    onMounted(() => {
      if (!props.animate) {
        animated.value = true;
        return;
      }
      const prefersReduced =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (prefersReduced) {
        animated.value = true;
        return;
      }
      send({ type: 'ANIMATE_IN' });
      frameId = requestAnimationFrame(() => {
        animated.value = true;
        animationTimer = setTimeout(() => send({ type: 'ANIMATION_END' }), 400);
      });
    });

    onUnmounted(() => {
      if (frameId != null) cancelAnimationFrame(frameId);
      if (animationTimer) clearTimeout(animationTimer);
    });

    const handleSegmentMouseEnter = (index: number) => {
      hoveredIndex.value = index;
      send({ type: 'HOVER_SEGMENT', index });
      emit('segmentHover', index, props.segments[index] ?? null);
    };

    const handleSegmentMouseLeave = () => {
      hoveredIndex.value = null;
      send({ type: 'UNHOVER' });
      emit('segmentHover', null, null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (props.segments.length === 0) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const next = focusedIndex.value < props.segments.length - 1 ? focusedIndex.value + 1 : 0;
        focusedIndex.value = next;
        hoveredIndex.value = next;
        send({ type: 'HOVER_SEGMENT', index: next });
        emit('segmentHover', next, props.segments[next] ?? null);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const prev = focusedIndex.value > 0 ? focusedIndex.value - 1 : props.segments.length - 1;
        focusedIndex.value = prev;
        hoveredIndex.value = prev;
        send({ type: 'HOVER_SEGMENT', index: prev });
        emit('segmentHover', prev, props.segments[prev] ?? null);
      } else if (e.key === 'Escape') {
        hoveredIndex.value = null;
        focusedIndex.value = -1;
        send({ type: 'UNHOVER' });
        emit('segmentHover', null, null);
      }
    };

    return () => {
      const barHeight = SIZE_MAP[props.size] ?? SIZE_MAP.md;

      return h('div', {
        role: 'img',
        'aria-label': 'Vote results',
        'aria-roledescription': 'vote result bar',
        'aria-description': ariaDescription.value,
        'data-surface-widget': '',
        'data-widget-name': 'vote-result-bar',
        'data-part': 'root',
        'data-state': state.value,
        'data-variant': props.variant,
        'data-size': props.size,
        tabindex: 0,
        onKeydown: handleKeyDown,
        style: { position: 'relative' },
      }, [
        // Bar
        h('div', {
          'data-part': 'bar',
          'data-state': state.value,
          'data-total': total.value,
          style: {
            display: 'flex',
            width: '100%',
            height: `${barHeight}px`,
            borderRadius: '4px',
            overflow: 'hidden',
            position: 'relative',
            backgroundColor: '#e0e0e0',
          },
        }, [
          ...computedSegments.value.map((seg, i) => {
            const isHovered = hoveredIndex.value === i;
            const isFocused = focusedIndex.value === i;
            const widthPercent = animated.value ? seg.percent : 0;
            const minWidth = seg.count === 0 && total.value > 0 ? '2px' : undefined;

            return h('div', {
              key: `${seg.label}-${i}`,
              'data-part': 'segment',
              'data-state': state.value,
              'data-choice': seg.label,
              'data-percent': formatPercent(seg.percent),
              'data-color': seg.resolvedColor,
              'data-hovered': isHovered ? 'true' : undefined,
              role: 'img',
              'aria-label': `${seg.label}: ${seg.count} votes (${formatPercent(seg.percent)}%)`,
              tabindex: -1,
              style: {
                width: minWidth ?? `${widthPercent}%`,
                minWidth: minWidth,
                backgroundColor: seg.resolvedColor,
                transition: props.animate ? 'width 0.4s ease-out, opacity 0.2s ease' : undefined,
                opacity: hoveredIndex.value !== null && !isHovered ? 0.5 : 1,
                position: 'relative',
                cursor: 'pointer',
                outline: isFocused ? '2px solid #1a73e8' : undefined,
                outlineOffset: isFocused ? '-2px' : undefined,
              },
              onMouseenter: () => handleSegmentMouseEnter(i),
              onMouseleave: handleSegmentMouseLeave,
            }, isHovered
              ? [h('div', {
                  role: 'tooltip',
                  style: {
                    position: 'absolute', bottom: '100%', left: '50%',
                    transform: 'translateX(-50%)', marginBottom: '4px',
                    padding: '4px 8px', backgroundColor: 'rgba(0, 0, 0, 0.85)',
                    color: '#fff', fontSize: '12px', borderRadius: '4px',
                    whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 10,
                  },
                }, `${seg.label}: ${seg.count} votes (${formatPercent(seg.percent)}%)`)]
              : []);
          }),
          // Quorum marker
          props.showQuorum && props.quorumThreshold > 0
            ? h('div', {
                'data-part': 'quorum-marker',
                'data-state': state.value,
                'data-visible': 'true',
                role: 'img',
                'aria-label': `Quorum threshold at ${props.quorumThreshold}%`,
                style: {
                  position: 'absolute', left: `${props.quorumThreshold}%`,
                  top: 0, bottom: 0, width: '2px',
                  backgroundColor: '#000', zIndex: 5, pointerEvents: 'none',
                },
              })
            : null,
        ]),

        // Segment labels
        props.showLabels
          ? h('div', {
              style: {
                display: 'flex', justifyContent: 'space-between',
                marginTop: '4px', flexWrap: 'wrap', gap: '4px 12px',
              },
            }, computedSegments.value.map((seg, i) =>
              h('span', {
                key: `label-${seg.label}-${i}`,
                'data-part': 'segment-label',
                'data-state': state.value,
                'data-visible': 'true',
                style: {
                  fontSize: props.size === 'sm' ? '11px' : props.size === 'lg' ? '14px' : '12px',
                  color: '#555', display: 'inline-flex', alignItems: 'center', gap: '4px',
                },
              }, [
                h('span', {
                  'aria-hidden': 'true',
                  style: {
                    display: 'inline-block', width: '8px', height: '8px',
                    borderRadius: '50%', backgroundColor: seg.resolvedColor,
                  },
                }),
                `${seg.label} ${seg.count} (${formatPercent(seg.percent)}%)`,
              ]),
            ))
          : null,

        // Total label
        h('span', {
          'data-part': 'total-label',
          'data-state': state.value,
          'aria-label': `Total votes: ${total.value}`,
          style: {
            display: 'block', marginTop: '4px',
            fontSize: props.size === 'sm' ? '11px' : props.size === 'lg' ? '14px' : '12px',
            color: '#777',
          },
        }, `Total: ${total.value}`),

        // Slot content
        slots.default ? slots.default() : null,
      ]);
    };
  },
});

export default VoteResultBar;
