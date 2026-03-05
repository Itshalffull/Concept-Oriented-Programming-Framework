import { defineComponent, h, ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';

export type SlaTimerState = 'onTrack' | 'warning' | 'critical' | 'breached' | 'paused';
export type SlaTimerEvent =
  | { type: 'TICK' }
  | { type: 'WARNING_THRESHOLD' }
  | { type: 'PAUSE' }
  | { type: 'CRITICAL_THRESHOLD' }
  | { type: 'BREACH' }
  | { type: 'RESUME' };

export function slaTimerReducer(state: SlaTimerState, event: SlaTimerEvent): SlaTimerState {
  switch (state) {
    case 'onTrack':
      if (event.type === 'TICK') return 'onTrack';
      if (event.type === 'WARNING_THRESHOLD') return 'warning';
      if (event.type === 'PAUSE') return 'paused';
      return state;
    case 'warning':
      if (event.type === 'TICK') return 'warning';
      if (event.type === 'CRITICAL_THRESHOLD') return 'critical';
      if (event.type === 'PAUSE') return 'paused';
      return state;
    case 'critical':
      if (event.type === 'TICK') return 'critical';
      if (event.type === 'BREACH') return 'breached';
      if (event.type === 'PAUSE') return 'paused';
      return state;
    case 'breached':
      if (event.type === 'TICK') return 'breached';
      return state;
    case 'paused':
      if (event.type === 'RESUME') return 'onTrack';
      return state;
    default:
      return state;
  }
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatElapsed(ms: number): string {
  if (ms <= 0) return '0s';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

const PHASE_LABELS: Record<SlaTimerState, string> = {
  onTrack: 'On Track',
  warning: 'Warning',
  critical: 'Critical',
  breached: 'Breached',
  paused: 'Paused',
};

export const SlaTimer = defineComponent({
  name: 'SlaTimer',
  props: {
    dueAt: { type: String, required: true },
    status: { type: String, required: true },
    warningThreshold: { type: Number, default: 0.7 },
    criticalThreshold: { type: Number, default: 0.9 },
    showElapsed: { type: Boolean, default: true },
    startedAt: { type: String, default: undefined },
  },
  emits: ['breach', 'warning', 'critical'],
  setup(props, { emit, slots }) {
    const state = ref<SlaTimerState>('onTrack');
    const remaining = ref(0);
    const elapsed = ref(0);
    const progress = ref(0);
    let timer: ReturnType<typeof setInterval> | undefined;
    const breachedFlag = ref(false);
    const warningFlag = ref(false);
    const criticalFlag = ref(false);

    function send(event: SlaTimerEvent) {
      state.value = slaTimerReducer(state.value, event);
    }

    function startTimer() {
      if (timer) clearInterval(timer);

      const dueTime = new Date(props.dueAt).getTime();
      const startTime = props.startedAt ? new Date(props.startedAt).getTime() : Date.now();
      const totalDuration = dueTime - startTime;

      const tick = () => {
        if (state.value === 'paused') return;

        const now = Date.now();
        const rem = Math.max(0, dueTime - now);
        const elap = now - startTime;
        const prog = totalDuration > 0 ? Math.min(1, elap / totalDuration) : 1;

        remaining.value = rem;
        elapsed.value = elap;
        progress.value = prog;

        send({ type: 'TICK' });

        if (rem <= 0 && !breachedFlag.value) {
          breachedFlag.value = true;
          send({ type: 'BREACH' });
          emit('breach');
        } else if (prog >= props.criticalThreshold && !criticalFlag.value && rem > 0) {
          criticalFlag.value = true;
          send({ type: 'CRITICAL_THRESHOLD' });
          emit('critical');
        } else if (prog >= props.warningThreshold && !warningFlag.value && rem > 0) {
          warningFlag.value = true;
          send({ type: 'WARNING_THRESHOLD' });
          emit('warning');
        }
      };

      tick();
      timer = setInterval(tick, 1000);
    }

    function stopTimer() {
      if (timer) {
        clearInterval(timer);
        timer = undefined;
      }
    }

    watch(state, (s) => {
      if (s === 'paused') {
        stopTimer();
      } else if (s !== 'breached') {
        startTimer();
      }
    });

    onMounted(() => {
      startTimer();
    });

    onBeforeUnmount(() => {
      stopTimer();
    });

    function handlePause() {
      send({ type: 'PAUSE' });
    }

    function handleResume() {
      send({ type: 'RESUME' });
    }

    const progressPercent = computed(() => Math.round(progress.value * 100));

    return () => {
      const children: any[] = [];

      // Countdown display
      children.push(h('span', {
        'data-part': 'countdown',
        'aria-label': `Time remaining: ${formatCountdown(remaining.value)}`,
      }, state.value === 'breached' ? 'BREACHED' : formatCountdown(remaining.value)));

      // Phase label
      children.push(h('span', {
        'data-part': 'phase', role: 'status', 'data-phase': state.value,
      }, PHASE_LABELS[state.value]));

      // Progress bar
      children.push(h('div', {
        'data-part': 'progress', 'data-phase': state.value,
        role: 'progressbar',
        'aria-valuenow': progressPercent.value,
        'aria-valuemin': 0, 'aria-valuemax': 100,
        'aria-label': `SLA progress: ${progressPercent.value}%`,
      }, [
        h('div', {
          'data-part': 'progress-fill', 'data-phase': state.value,
          style: { width: `${progressPercent.value}%` },
          'aria-hidden': 'true',
        }),
      ]));

      // Elapsed time
      if (props.showElapsed) {
        children.push(h('span', {
          'data-part': 'elapsed', 'data-visible': 'true',
          'aria-label': `Elapsed time: ${formatElapsed(elapsed.value)}`,
        }, `Elapsed: ${formatElapsed(elapsed.value)}`));
      }

      // Pause/Resume control
      if (state.value !== 'breached') {
        children.push(h('button', {
          type: 'button', 'data-part': 'pause-resume',
          onClick: state.value === 'paused' ? handleResume : handlePause,
          'aria-label': state.value === 'paused' ? 'Resume timer' : 'Pause timer',
        }, state.value === 'paused' ? 'Resume' : 'Pause'));
      }

      if (slots.default) children.push(slots.default());

      return h('div', {
        role: 'timer',
        'aria-label': `SLA timer: ${PHASE_LABELS[state.value]}`,
        'aria-live': 'polite',
        'data-surface-widget': '',
        'data-widget-name': 'sla-timer',
        'data-part': 'root',
        'data-state': state.value,
        tabindex: 0,
      }, children);
    };
  },
});

export default SlaTimer;
