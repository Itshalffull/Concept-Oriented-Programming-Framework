import { defineComponent, h, ref, computed, watch, onMounted, onUnmounted } from 'vue';

/* ---------------------------------------------------------------------------
 * VerificationStatusBadge state machine
 * ------------------------------------------------------------------------- */

export type VerificationStatusBadgeState = 'idle' | 'hovered' | 'animating';
export type VerificationStatusBadgeEvent =
  | { type: 'HOVER' }
  | { type: 'STATUS_CHANGE' }
  | { type: 'LEAVE' }
  | { type: 'ANIMATION_END' };

export function verificationStatusBadgeReducer(state: VerificationStatusBadgeState, event: VerificationStatusBadgeEvent): VerificationStatusBadgeState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER') return 'hovered';
      if (event.type === 'STATUS_CHANGE') return 'animating';
      return state;
    case 'hovered':
      if (event.type === 'LEAVE') return 'idle';
      return state;
    case 'animating':
      if (event.type === 'ANIMATION_END') return 'idle';
      return state;
    default:
      return state;
  }
}

/* ---------------------------------------------------------------------------
 * Types & Helpers
 * ------------------------------------------------------------------------- */

export type VerificationStatus = 'proved' | 'refuted' | 'unknown' | 'timeout' | 'running';

function statusIcon(status: VerificationStatus) {
  const shared = {
    xmlns: 'http://www.w3.org/2000/svg', width: '16', height: '16', viewBox: '0 0 16 16',
    fill: 'none', stroke: 'currentColor', 'stroke-width': '2',
    'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true',
  };

  switch (status) {
    case 'proved':
      return h('svg', { ...shared, 'data-icon': 'checkmark' }, [
        h('polyline', { points: '3.5 8.5 6.5 11.5 12.5 4.5' }),
      ]);
    case 'refuted':
      return h('svg', { ...shared, 'data-icon': 'cross' }, [
        h('line', { x1: '4', y1: '4', x2: '12', y2: '12' }),
        h('line', { x1: '12', y1: '4', x2: '4', y2: '12' }),
      ]);
    case 'unknown':
      return h('svg', { ...shared, 'data-icon': 'question' }, [
        h('path', { d: 'M6 5.5a2.5 2.5 0 0 1 4.5 1.5c0 1.5-2.5 2-2.5 3.5' }),
        h('circle', { cx: '8', cy: '12.5', r: '0.5', fill: 'currentColor', stroke: 'none' }),
      ]);
    case 'timeout':
      return h('svg', { ...shared, 'data-icon': 'clock' }, [
        h('circle', { cx: '8', cy: '8', r: '5.5' }),
        h('polyline', { points: '8 5 8 8 10.5 9.5' }),
      ]);
    case 'running':
      return h('svg', { ...shared, 'data-icon': 'spinner', 'data-animating': 'true' }, [
        h('circle', { cx: '8', cy: '8', r: '5.5', 'stroke-dasharray': '20 12' }),
      ]);
  }
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export const VerificationStatusBadge = defineComponent({
  name: 'VerificationStatusBadge',
  props: {
    status: { type: String as () => VerificationStatus, default: 'unknown' },
    label: { type: String, default: 'Unknown' },
    duration: { type: Number, default: undefined },
    solver: { type: String, default: undefined },
    size: { type: String as () => 'sm' | 'md' | 'lg', default: 'md' },
  },
  setup(props) {
    const state = ref<VerificationStatusBadgeState>('idle');
    const send = (event: VerificationStatusBadgeEvent) => {
      state.value = verificationStatusBadgeReducer(state.value, event);
    };

    const reducedMotion = ref(false);
    let animationTimer: ReturnType<typeof setTimeout> | undefined;

    const tooltipId = `vsb-tooltip-${Math.random().toString(36).slice(2, 9)}`;

    /* -- Detect prefers-reduced-motion ----------------------------------- */
    onMounted(() => {
      if (typeof window === 'undefined') return;
      const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
      reducedMotion.value = mql.matches;
      const handler = (e: MediaQueryListEvent) => { reducedMotion.value = e.matches; };
      mql.addEventListener('change', handler);
      onUnmounted(() => mql.removeEventListener('change', handler));
    });

    /* -- Trigger STATUS_CHANGE when status prop changes ------------------ */
    watch(() => props.status, (_newVal, oldVal) => {
      if (oldVal !== undefined && oldVal !== _newVal) {
        if (reducedMotion.value) return;
        send({ type: 'STATUS_CHANGE' });
      }
    });

    /* -- Auto-end animation after a short delay -------------------------- */
    watch(state, (newState) => {
      if (newState === 'animating') {
        const ms = reducedMotion.value ? 0 : 200;
        animationTimer = setTimeout(() => send({ type: 'ANIMATION_END' }), ms);
      }
    });

    onUnmounted(() => { if (animationTimer) clearTimeout(animationTimer); });

    /* -- Tooltip --------------------------------------------------------- */
    const tooltipVisible = computed(() => state.value === 'hovered');
    const hasTooltipContent = computed(() => props.solver != null || props.duration != null);
    const tooltipText = computed(() => {
      return [props.solver ?? null, props.duration != null ? `${props.duration}ms` : null]
        .filter(Boolean)
        .join(' \u2014 ');
    });

    return () => h('div', {
      role: 'status', 'aria-live': 'polite',
      'aria-label': `Verification status: ${props.label}`,
      'aria-describedby': hasTooltipContent.value ? tooltipId : undefined,
      'data-surface-widget': '', 'data-widget-name': 'verification-status-badge',
      'data-part': 'root', 'data-state': state.value,
      'data-status': props.status, 'data-size': props.size,
      tabindex: 0,
      onPointerenter: () => send({ type: 'HOVER' }),
      onPointerleave: () => send({ type: 'LEAVE' }),
      onFocus: () => send({ type: 'HOVER' }),
      onBlur: () => send({ type: 'LEAVE' }),
    }, [
      h('span', { 'data-part': 'icon', 'data-status': props.status, 'aria-hidden': 'true' }, [
        statusIcon(props.status),
      ]),
      h('span', { 'data-part': 'label' }, props.label),
      hasTooltipContent.value
        ? h('div', {
            id: tooltipId, role: 'tooltip', 'data-part': 'tooltip',
            'data-visible': tooltipVisible.value ? 'true' : 'false',
            'aria-hidden': tooltipVisible.value ? 'false' : 'true',
            style: {
              visibility: tooltipVisible.value ? 'visible' : 'hidden',
              position: 'absolute', pointerEvents: 'none',
            },
          }, tooltipText.value)
        : null,
    ]);
  },
});

export default VerificationStatusBadge;
