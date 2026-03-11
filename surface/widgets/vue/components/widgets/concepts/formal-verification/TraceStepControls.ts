import { defineComponent, h, ref, computed, watch, onUnmounted } from 'vue';

/* ---------------------------------------------------------------------------
 * TraceStepControls state machine
 * ------------------------------------------------------------------------- */

export type TraceStepControlsState = 'paused' | 'playing';
export type TraceStepControlsEvent =
  | { type: 'PLAY' }
  | { type: 'STEP_FWD' }
  | { type: 'STEP_BACK' }
  | { type: 'JUMP_START' }
  | { type: 'JUMP_END' }
  | { type: 'PAUSE' }
  | { type: 'REACH_END' };

export function traceStepControlsReducer(state: TraceStepControlsState, event: TraceStepControlsEvent): TraceStepControlsState {
  switch (state) {
    case 'paused':
      if (event.type === 'PLAY') return 'playing';
      if (event.type === 'STEP_FWD') return 'paused';
      if (event.type === 'STEP_BACK') return 'paused';
      if (event.type === 'JUMP_START') return 'paused';
      if (event.type === 'JUMP_END') return 'paused';
      return state;
    case 'playing':
      if (event.type === 'PAUSE') return 'paused';
      if (event.type === 'REACH_END') return 'paused';
      return state;
    default:
      return state;
  }
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const SPEED_OPTIONS = [1, 2, 4] as const;

export const TraceStepControls = defineComponent({
  name: 'TraceStepControls',
  props: {
    currentStep: { type: Number, required: true },
    totalSteps: { type: Number, required: true },
    playing: { type: Boolean, required: true },
    speed: { type: Number, default: 1 },
    showSpeed: { type: Boolean, default: true },
  },
  emits: ['stepForward', 'stepBack', 'play', 'pause', 'seek', 'first', 'last', 'speedChange'],
  setup(props, { slots, emit }) {
    const state = ref<TraceStepControlsState>(props.playing ? 'playing' : 'paused');
    const send = (event: TraceStepControlsEvent) => { state.value = traceStepControlsReducer(state.value, event); };

    let playInterval: ReturnType<typeof setInterval> | null = null;
    const rovingIndex = ref(2); // initial focus: play/pause button

    const atFirst = computed(() => props.currentStep <= 0);
    const atLast = computed(() => props.currentStep >= props.totalSteps - 1);
    const progressPercent = computed(() => props.totalSteps > 0 ? ((props.currentStep + 1) / props.totalSteps) * 100 : 0);

    // Sync internal state with external playing prop
    watch(() => props.playing, (playing) => {
      if (playing && state.value === 'paused') send({ type: 'PLAY' });
      else if (!playing && state.value === 'playing') send({ type: 'PAUSE' });
    });

    const startPlayback = () => {
      if (playInterval) clearInterval(playInterval);
      const intervalMs = 1000 / props.speed;
      playInterval = setInterval(() => { emit('stepForward'); }, intervalMs);
    };

    const stopPlayback = () => {
      if (playInterval) { clearInterval(playInterval); playInterval = null; }
    };

    watch(state, (s) => {
      if (s === 'playing') startPlayback();
      else stopPlayback();
    });

    // Auto-pause at end
    watch(() => props.currentStep, () => {
      if (state.value === 'playing' && atLast.value) {
        send({ type: 'REACH_END' });
        emit('pause');
      }
    });

    // Restart interval when speed changes during playback
    watch(() => props.speed, () => {
      if (state.value === 'playing') startPlayback();
    });

    onUnmounted(stopPlayback);

    const handlePlay = () => { if (atLast.value) return; send({ type: 'PLAY' }); emit('play'); };
    const handlePause = () => { send({ type: 'PAUSE' }); emit('pause'); };
    const handleStepForward = () => { if (atLast.value) return; send({ type: 'STEP_FWD' }); emit('stepForward'); };
    const handleStepBack = () => { if (atFirst.value) return; send({ type: 'STEP_BACK' }); emit('stepBack'); };
    const handleJumpStart = () => { if (atFirst.value) return; send({ type: 'JUMP_START' }); emit('first'); };
    const handleJumpEnd = () => { if (atLast.value) return; send({ type: 'JUMP_END' }); emit('last'); };

    const handleProgressClick = (e: MouseEvent) => {
      if (props.totalSteps <= 0) return;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ratio = x / rect.width;
      const step = Math.round(ratio * (props.totalSteps - 1));
      emit('seek', Math.max(0, Math.min(props.totalSteps - 1, step)));
    };

    // Roving tabindex
    const setRovingFocus = (index: number) => {
      rovingIndex.value = Math.max(0, Math.min(4, index));
    };

    const handleToolbarKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case ' ': e.preventDefault(); if (state.value === 'playing') handlePause(); else handlePlay(); break;
        case 'ArrowRight': e.preventDefault(); handleStepForward(); break;
        case 'ArrowLeft': e.preventDefault(); handleStepBack(); break;
        case 'Home': e.preventDefault(); handleJumpStart(); break;
        case 'End': e.preventDefault(); handleJumpEnd(); break;
      }
    };

    const handleButtonKeyDown = (e: KeyboardEvent, index: number) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault(); e.stopPropagation(); setRovingFocus(index + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault(); e.stopPropagation(); setRovingFocus(index - 1);
      }
    };

    function transportButton(index: number, part: string, label: string, disabled: boolean, onClick: () => void, content: string) {
      return h('button', {
        type: 'button', 'data-part': part, 'data-state': state.value,
        'aria-label': label, 'aria-disabled': disabled ? 'true' : 'false',
        disabled, tabindex: rovingIndex.value === index ? 0 : -1,
        onClick, onKeydown: (e: KeyboardEvent) => handleButtonKeyDown(e, index),
      }, content);
    }

    return () => h('div', {
      role: 'toolbar', 'aria-label': 'Trace step controls',
      'data-surface-widget': '', 'data-widget-name': 'trace-step-controls',
      'data-part': 'root', 'data-state': state.value,
      onKeydown: handleToolbarKeyDown, tabindex: 0,
    }, [
      // Transport controls
      h('div', { 'data-part': 'transport', 'data-state': state.value }, [
        transportButton(0, 'jump-start', 'Jump to start', atFirst.value, handleJumpStart, '\u25C4\u2502'),
        transportButton(1, 'step-back', 'Step backward', atFirst.value, handleStepBack, '\u25C4'),
        h('button', {
          type: 'button', 'data-part': 'play-pause', 'data-state': state.value,
          'aria-label': state.value === 'playing' ? 'Pause' : 'Play',
          tabindex: rovingIndex.value === 2 ? 0 : -1,
          onClick: state.value === 'playing' ? handlePause : handlePlay,
          onKeydown: (e: KeyboardEvent) => handleButtonKeyDown(e, 2),
        }, state.value === 'playing' ? '\u23F8' : '\u25B6'),
        transportButton(3, 'step-fwd', 'Step forward', atLast.value, handleStepForward, '\u25BA'),
        transportButton(4, 'jump-end', 'Jump to end', atLast.value, handleJumpEnd, '\u2502\u25BA'),
      ]),
      // Step counter
      h('span', {
        'data-part': 'step-counter', 'data-state': state.value,
        role: 'status', 'aria-live': 'polite',
        'aria-label': `Step ${props.currentStep + 1} of ${props.totalSteps}`,
      }, `Step ${props.currentStep + 1} of ${props.totalSteps}`),
      // Progress bar
      h('div', {
        'data-part': 'progress-bar', 'data-state': state.value,
        role: 'progressbar', 'aria-valuenow': props.currentStep + 1,
        'aria-valuemin': 1, 'aria-valuemax': props.totalSteps,
        'aria-label': 'Trace progress',
        onClick: handleProgressClick,
        style: { cursor: 'pointer', position: 'relative' },
      }, [
        h('div', {
          'data-part': 'progress-fill', 'data-state': state.value,
          style: { width: `${progressPercent.value}%`, height: '100%', position: 'absolute', top: '0', left: '0' },
        }),
      ]),
      // Speed control
      props.showSpeed
        ? h('div', { 'data-part': 'speed-control', 'data-state': state.value, 'data-visible': 'true' },
            SPEED_OPTIONS.map((s) =>
              h('button', {
                key: s, type: 'button', 'data-part': 'speed-option', 'data-state': state.value,
                'data-selected': s === props.speed ? 'true' : 'false',
                'aria-label': `Playback speed ${s}x`,
                'aria-pressed': s === props.speed ? 'true' : 'false',
                onClick: () => emit('speedChange', s),
              }, `${s}x`),
            ),
          )
        : null,
      slots.default ? slots.default() : null,
    ]);
  },
});

export default TraceStepControls;
