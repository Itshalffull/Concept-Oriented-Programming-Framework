import { defineComponent, h, ref, computed, onMounted, onUnmounted, watch } from 'vue';

/* ---------------------------------------------------------------------------
 * TimelockCountdown state machine
 * ------------------------------------------------------------------------- */

export type TimelockCountdownState = 'running' | 'warning' | 'critical' | 'expired' | 'executing' | 'completed' | 'paused';
export type TimelockCountdownEvent =
  | { type: 'TICK' }
  | { type: 'WARNING_THRESHOLD' }
  | { type: 'EXPIRE' }
  | { type: 'PAUSE' }
  | { type: 'CRITICAL_THRESHOLD' }
  | { type: 'EXECUTE' }
  | { type: 'RESET' }
  | { type: 'EXECUTE_COMPLETE' }
  | { type: 'EXECUTE_ERROR' }
  | { type: 'RESUME' }
  | { type: 'CHALLENGE' };

export function timelockCountdownReducer(state: TimelockCountdownState, event: TimelockCountdownEvent): TimelockCountdownState {
  switch (state) {
    case 'running':
      if (event.type === 'TICK') return 'running';
      if (event.type === 'WARNING_THRESHOLD') return 'warning';
      if (event.type === 'EXPIRE') return 'expired';
      if (event.type === 'PAUSE') return 'paused';
      return state;
    case 'warning':
      if (event.type === 'TICK') return 'warning';
      if (event.type === 'CRITICAL_THRESHOLD') return 'critical';
      if (event.type === 'EXPIRE') return 'expired';
      return state;
    case 'critical':
      if (event.type === 'TICK') return 'critical';
      if (event.type === 'EXPIRE') return 'expired';
      return state;
    case 'expired':
      if (event.type === 'EXECUTE') return 'executing';
      if (event.type === 'RESET') return 'running';
      return state;
    case 'executing':
      if (event.type === 'EXECUTE_COMPLETE') return 'completed';
      if (event.type === 'EXECUTE_ERROR') return 'expired';
      return state;
    case 'completed':
      return state;
    case 'paused':
      if (event.type === 'RESUME') return 'running';
      return state;
    default:
      return state;
  }
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

interface TimeRemaining { days: number; hours: number; minutes: number; seconds: number; totalMs: number; }

function computeTimeRemaining(deadline: Date): TimeRemaining {
  const totalMs = Math.max(0, deadline.getTime() - Date.now());
  const totalSeconds = Math.floor(totalMs / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    totalMs,
  };
}

function formatRemaining(tr: TimeRemaining): string {
  if (tr.totalMs <= 0) return '0s';
  const parts: string[] = [];
  if (tr.days > 0) parts.push(`${tr.days}d`);
  if (tr.hours > 0) parts.push(`${tr.hours}h`);
  if (tr.minutes > 0) parts.push(`${tr.minutes}m`);
  parts.push(`${tr.seconds}s`);
  return parts.join(' ');
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export const TimelockCountdown = defineComponent({
  name: 'TimelockCountdown',
  props: {
    phase: { type: String, required: true },
    deadline: { type: String, required: true },
    elapsed: { type: Number, required: true },
    total: { type: Number, required: true },
    showChallenge: { type: Boolean, default: true },
    warningThreshold: { type: Number, default: 0.8 },
    criticalThreshold: { type: Number, default: 0.95 },
    variant: { type: String, default: 'phase-based' },
  },
  emits: ['execute', 'challenge'],
  setup(props, { slots, emit }) {
    const state = ref<TimelockCountdownState>('running');
    const send = (event: TimelockCountdownEvent) => {
      state.value = timelockCountdownReducer(state.value, event);
    };

    const timeRemaining = ref<TimeRemaining>(computeTimeRemaining(new Date(props.deadline)));
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const deadlineDate = computed(() => new Date(props.deadline));
    const progress = computed(() => props.total <= 0 ? 0 : Math.min(1, Math.max(0, props.elapsed / props.total)));
    const countdownText = computed(() => formatRemaining(timeRemaining.value));
    const formattedDeadline = computed(() => {
      try {
        return deadlineDate.value.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
      } catch { return props.deadline; }
    });
    const displayPhase = computed(() => {
      switch (state.value) {
        case 'expired': return 'Ready to execute';
        case 'executing': return 'Executing...';
        case 'completed': return 'Execution complete';
        case 'paused': return `${props.phase} (paused)`;
        default: return props.phase;
      }
    });

    const stopInterval = () => {
      if (intervalId !== null) { clearInterval(intervalId); intervalId = null; }
    };

    const tick = () => {
      const tr = computeTimeRemaining(deadlineDate.value);
      timeRemaining.value = tr;
      if (tr.totalMs <= 0) { send({ type: 'EXPIRE' }); return; }
      const currentProgress = props.total > 0 ? Math.min(1, props.elapsed / props.total) : 0;
      if (state.value === 'running' && currentProgress >= props.warningThreshold) {
        send({ type: 'WARNING_THRESHOLD' });
      } else if (state.value === 'warning' && currentProgress >= props.criticalThreshold) {
        send({ type: 'CRITICAL_THRESHOLD' });
      } else {
        send({ type: 'TICK' });
      }
    };

    watch(state, (s) => {
      const tickingStates: TimelockCountdownState[] = ['running', 'warning', 'critical'];
      if (!tickingStates.includes(s)) { stopInterval(); return; }
      stopInterval();
      tick();
      intervalId = setInterval(tick, 1000);
    }, { immediate: true });

    // Expire immediately if deadline already past
    onMounted(() => {
      if (deadlineDate.value.getTime() <= Date.now() && state.value === 'running') {
        send({ type: 'EXPIRE' });
      }
    });

    onUnmounted(stopInterval);

    const handleExecute = () => {
      if (state.value === 'expired') { send({ type: 'EXECUTE' }); emit('execute'); }
    };
    const handleChallenge = () => {
      const disabled: TimelockCountdownState[] = ['expired', 'completed', 'executing'];
      if (!disabled.includes(state.value)) emit('challenge');
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); handleExecute(); }
      if (e.key === 'c' && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); handleChallenge(); }
    };

    return () => {
      const executeDisabled = state.value !== 'expired';
      const challengeDisabled = state.value === 'expired' || state.value === 'completed' || state.value === 'executing';
      const progressPercent = Math.round(progress.value * 100);

      return h('div', {
        role: 'timer', 'aria-label': `${displayPhase.value}: ${countdownText.value}`,
        'aria-live': 'polite',
        'data-surface-widget': '', 'data-widget-name': 'timelock-countdown',
        'data-part': 'root', 'data-state': state.value, 'data-variant': props.variant,
        onKeydown: handleKeyDown, tabindex: 0,
      }, [
        h('span', { 'data-part': 'phase-label', 'data-state': state.value }, displayPhase.value),
        h('span', {
          'data-part': 'countdown-text', 'data-state': state.value,
          'data-urgency': state.value, 'aria-atomic': 'true',
        }, state.value === 'completed' ? 'Done' : countdownText.value),
        h('span', { 'data-part': 'target-date', 'data-state': state.value }, formattedDeadline.value),
        h('div', {
          'data-part': 'progress-bar', 'data-state': state.value, 'data-progress': progress.value,
          role: 'progressbar', 'aria-valuenow': progressPercent,
          'aria-valuemin': 0, 'aria-valuemax': 100,
          'aria-label': `Timelock progress: ${progressPercent}%`,
        }, [
          h('div', {
            'data-part': 'progress-fill',
            style: { width: `${progressPercent}%`, height: '100%', transition: 'width 0.3s ease' },
          }),
        ]),
        h('button', {
          type: 'button', 'data-part': 'execute-button', 'data-state': state.value,
          'aria-label': 'Execute proposal', 'aria-disabled': executeDisabled,
          disabled: executeDisabled, tabindex: 0, onClick: handleExecute,
        }, state.value === 'executing' ? 'Executing...' : 'Execute'),
        props.showChallenge
          ? h('button', {
              type: 'button', 'data-part': 'challenge-button', 'data-state': state.value,
              'data-visible': 'true', 'aria-label': 'Challenge execution',
              'aria-disabled': challengeDisabled, disabled: challengeDisabled,
              tabindex: 0, onClick: handleChallenge,
            }, 'Challenge')
          : null,
        slots.default ? slots.default() : null,
      ]);
    };
  },
});

export default TimelockCountdown;
