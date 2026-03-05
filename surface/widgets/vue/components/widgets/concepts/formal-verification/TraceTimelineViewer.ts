import { defineComponent, h, ref, computed, watch, onUnmounted } from 'vue';

/* ---------------------------------------------------------------------------
 * TraceTimelineViewer state machine
 * ------------------------------------------------------------------------- */

export type TraceTimelineViewerState = 'idle' | 'playing' | 'cellSelected';
export type TraceTimelineViewerEvent =
  | { type: 'PLAY' }
  | { type: 'STEP_FORWARD' }
  | { type: 'STEP_BACKWARD' }
  | { type: 'SELECT_CELL' }
  | { type: 'ZOOM' }
  | { type: 'PAUSE' }
  | { type: 'STEP_END' }
  | { type: 'DESELECT' };

export function traceTimelineViewerReducer(state: TraceTimelineViewerState, event: TraceTimelineViewerEvent): TraceTimelineViewerState {
  switch (state) {
    case 'idle':
      if (event.type === 'PLAY') return 'playing';
      if (event.type === 'STEP_FORWARD') return 'idle';
      if (event.type === 'STEP_BACKWARD') return 'idle';
      if (event.type === 'SELECT_CELL') return 'cellSelected';
      if (event.type === 'ZOOM') return 'idle';
      return state;
    case 'playing':
      if (event.type === 'PAUSE') return 'idle';
      if (event.type === 'STEP_END') return 'idle';
      return state;
    case 'cellSelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'SELECT_CELL') return 'cellSelected';
      return state;
    default:
      return state;
  }
}

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export interface TraceStep {
  index: number;
  label: string;
  state: Record<string, string>;
  isError?: boolean;
  timestamp?: string;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export const TraceTimelineViewer = defineComponent({
  name: 'TraceTimelineViewer',
  props: {
    steps: { type: Array as () => TraceStep[], required: true },
    variables: { type: Array as () => string[], default: undefined },
    currentStep: { type: Number, default: undefined },
    playbackSpeed: { type: Number, default: 1.0 },
    showChangesOnly: { type: Boolean, default: false },
    zoom: { type: Number, default: 1.0 },
  },
  emits: ['stepChange'],
  setup(props, { slots, emit }) {
    const widgetState = ref<TraceTimelineViewerState>('idle');
    const send = (event: TraceTimelineViewerEvent) => {
      widgetState.value = traceTimelineViewerReducer(widgetState.value, event);
    };

    // Derive variable names
    const variableNames = computed(() => {
      if (props.variables) return props.variables;
      const keys = new Set<string>();
      for (const step of props.steps) {
        for (const k of Object.keys(step.state)) keys.add(k);
      }
      return Array.from(keys);
    });

    // Active step
    const internalStep = ref(0);
    const activeStep = computed(() => props.currentStep ?? internalStep.value);

    const goToStep = (idx: number) => {
      const clamped = Math.max(0, Math.min(idx, props.steps.length - 1));
      internalStep.value = clamped;
      emit('stepChange', clamped);
    };

    watch(() => props.currentStep, (val) => {
      if (val !== undefined) internalStep.value = val;
    });

    // Selected cell
    const selectedCell = ref<{ step: number; variable: string } | null>(null);

    // Playback timer
    let playbackInterval: ReturnType<typeof setInterval> | null = null;

    watch(widgetState, (newState) => {
      if (playbackInterval) { clearInterval(playbackInterval); playbackInterval = null; }
      if (newState === 'playing') {
        const intervalMs = Math.max(100, (1 / props.playbackSpeed) * 1000);
        playbackInterval = setInterval(() => {
          const next = internalStep.value + 1;
          if (next >= props.steps.length) {
            send({ type: 'STEP_END' });
            return;
          }
          internalStep.value = next;
          emit('stepChange', next);
        }, intervalMs);
      }
    });

    onUnmounted(() => { if (playbackInterval) clearInterval(playbackInterval); });

    // Focused lane
    const focusedLane = ref(0);

    // Helpers
    const didValueChange = (stepIdx: number, variable: string): boolean => {
      if (stepIdx === 0) return false;
      const prev = props.steps[stepIdx - 1]?.state[variable];
      const curr = props.steps[stepIdx]?.state[variable];
      return prev !== curr;
    };

    const currentStepData = computed(() => props.steps[activeStep.value] as TraceStep | undefined);

    // Keyboard
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault(); send({ type: 'STEP_FORWARD' }); goToStep(activeStep.value + 1); break;
        case 'ArrowLeft':
          e.preventDefault(); send({ type: 'STEP_BACKWARD' }); goToStep(activeStep.value - 1); break;
        case ' ':
          e.preventDefault();
          if (widgetState.value === 'playing') send({ type: 'PAUSE' });
          else send({ type: 'PLAY' });
          break;
        case 'Home': e.preventDefault(); goToStep(0); break;
        case 'End': e.preventDefault(); goToStep(props.steps.length - 1); break;
        case 'ArrowUp':
          e.preventDefault(); focusedLane.value = Math.max(0, focusedLane.value - 1); break;
        case 'ArrowDown':
          e.preventDefault(); focusedLane.value = Math.min(variableNames.value.length - 1, focusedLane.value + 1); break;
        case 'Enter':
          e.preventDefault();
          if (variableNames.value[focusedLane.value] !== undefined) {
            selectedCell.value = { step: activeStep.value, variable: variableNames.value[focusedLane.value] };
            send({ type: 'SELECT_CELL' });
          }
          break;
        case 'Escape':
          e.preventDefault(); selectedCell.value = null; send({ type: 'DESELECT' }); break;
      }
    };

    return () => h('div', {
      role: 'grid', 'aria-label': 'Trace timeline',
      'aria-rowcount': variableNames.value.length,
      'data-surface-widget': '', 'data-widget-name': 'trace-timeline-viewer',
      'data-part': 'root', 'data-state': widgetState.value, 'data-zoom': props.zoom,
      onKeydown: handleKeyDown, tabindex: 0,
    }, [
      // Time axis
      h('div', { 'data-part': 'time-axis', 'data-state': widgetState.value, 'data-step-count': props.steps.length, role: 'row' }, [
        h('span', { 'data-part': 'time-axis-corner', role: 'columnheader' }),
        ...props.steps.map((step) =>
          h('span', {
            key: step.index, 'data-part': 'time-axis-label', 'data-step': step.index,
            'data-error': step.isError ? 'true' : undefined,
            role: 'columnheader',
            'aria-label': `Step ${step.index}${step.isError ? ' (error)' : ''}`,
            style: step.isError ? { color: 'var(--trace-error-color, red)' } : undefined,
          }, step.index),
        ),
      ]),
      // Variable lanes
      h('div', { 'data-part': 'lanes', 'data-state': widgetState.value },
        variableNames.value.map((variable, laneIdx) =>
          h('div', {
            key: variable, 'data-part': 'lane', 'data-state': widgetState.value,
            'data-variable': variable,
            'data-focused': laneIdx === focusedLane.value ? 'true' : undefined,
            role: 'row', 'aria-label': variable,
          }, [
            h('span', { 'data-part': 'lane-label', 'data-state': widgetState.value }, variable),
            ...props.steps.map((step) => {
              const value = step.state[variable] ?? '';
              const changed = didValueChange(step.index, variable);
              if (props.showChangesOnly && !changed && step.index !== 0) return null;
              const isCurrent = step.index === activeStep.value;
              const isSelected = selectedCell.value?.step === step.index && selectedCell.value?.variable === variable;
              return h('div', {
                key: step.index, 'data-part': 'cell', 'data-state': widgetState.value,
                'data-step': step.index, 'data-changed': changed ? 'true' : 'false',
                'data-error': step.isError ? 'true' : undefined,
                'data-selected': isSelected ? 'true' : undefined,
                role: 'gridcell',
                'aria-label': `${variable} at step ${step.index}: ${value}`,
                'aria-current': isCurrent ? 'step' : undefined,
                style: {
                  ...(step.isError ? { backgroundColor: 'var(--trace-error-bg, #fee2e2)', color: 'var(--trace-error-color, red)' } : {}),
                  ...(changed ? { fontWeight: 'bold' } : {}),
                  ...(isSelected ? { outline: '2px solid var(--trace-selected-outline, currentColor)' } : {}),
                },
                onClick: () => {
                  selectedCell.value = { step: step.index, variable };
                  goToStep(step.index);
                  send({ type: 'SELECT_CELL' });
                },
                tabindex: -1,
              }, value);
            }).filter(Boolean),
          ]),
        ),
      ),
      // Step cursor
      h('div', { 'data-part': 'step-cursor', 'data-state': widgetState.value, 'data-position': activeStep.value, 'aria-hidden': 'true' }),
      // Playback controls
      h('div', { 'data-part': 'controls', 'data-state': widgetState.value, role: 'toolbar', 'aria-label': 'Playback controls' }, [
        h('button', {
          type: 'button', 'data-part': 'step-back-btn', 'aria-label': 'Step backward',
          disabled: activeStep.value <= 0, tabindex: 0,
          onClick: () => { send({ type: 'STEP_BACKWARD' }); goToStep(activeStep.value - 1); },
        }, '\u00AB'),
        h('button', {
          type: 'button', 'data-part': 'play-pause-btn',
          'aria-label': widgetState.value === 'playing' ? 'Pause' : 'Play', tabindex: 0,
          onClick: () => { if (widgetState.value === 'playing') send({ type: 'PAUSE' }); else send({ type: 'PLAY' }); },
        }, widgetState.value === 'playing' ? '\u23F8' : '\u25B6'),
        h('button', {
          type: 'button', 'data-part': 'step-fwd-btn', 'aria-label': 'Step forward',
          disabled: activeStep.value >= props.steps.length - 1, tabindex: 0,
          onClick: () => { send({ type: 'STEP_FORWARD' }); goToStep(activeStep.value + 1); },
        }, '\u00BB'),
        h('span', { 'data-part': 'step-counter', 'aria-live': 'polite' },
          props.steps.length > 0 ? `${activeStep.value + 1} / ${props.steps.length}` : '0 / 0'),
      ]),
      // Zoom controls
      h('div', { 'data-part': 'zoom-control', 'data-state': widgetState.value }, [
        h('button', { type: 'button', 'data-part': 'zoom-in-btn', 'aria-label': 'Zoom in', onClick: () => send({ type: 'ZOOM' }), tabindex: 0 }, '+'),
        h('button', { type: 'button', 'data-part': 'zoom-out-btn', 'aria-label': 'Zoom out', onClick: () => send({ type: 'ZOOM' }), tabindex: 0 }, '-'),
      ]),
      // Detail panel
      widgetState.value === 'cellSelected' && currentStepData.value
        ? h('div', {
            'data-part': 'detail-panel', 'data-state': widgetState.value, 'data-step': activeStep.value,
            role: 'region', 'aria-label': `State detail for step ${activeStep.value}`, 'aria-live': 'polite',
          }, [
            h('h3', { 'data-part': 'detail-title' }, [
              `Step ${currentStepData.value.index}: ${currentStepData.value.label}`,
              currentStepData.value.isError ? h('span', { 'data-part': 'detail-error-badge', style: { color: 'var(--trace-error-color, red)' } }, ' (error)') : null,
            ]),
            currentStepData.value.timestamp
              ? h('time', { 'data-part': 'detail-timestamp', datetime: currentStepData.value.timestamp }, currentStepData.value.timestamp)
              : null,
            h('dl', { 'data-part': 'detail-state' },
              Object.entries(currentStepData.value.state).map(([key, value]) =>
                h('div', { key, 'data-part': 'detail-entry', 'data-changed': didValueChange(activeStep.value, key) ? 'true' : 'false' }, [
                  h('dt', null, key),
                  h('dd', { style: didValueChange(activeStep.value, key) ? { fontWeight: 'bold' } : undefined }, value),
                ]),
              ),
            ),
          ])
        : null,
      slots.default ? slots.default() : null,
    ]);
  },
});

export default TraceTimelineViewer;
