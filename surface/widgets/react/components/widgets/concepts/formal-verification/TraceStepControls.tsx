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

import {
  forwardRef,
  useReducer,
  useEffect,
  useRef,
  useCallback,
  type HTMLAttributes,
  type ReactNode,
  type KeyboardEvent,
} from 'react';

const SPEED_OPTIONS = [1, 2, 4] as const;
type PlaybackSpeed = (typeof SPEED_OPTIONS)[number];

export interface TraceStepControlsProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  currentStep: number;
  totalSteps: number;
  playing: boolean;
  speed?: number;
  showSpeed?: boolean;
  onStepForward?: () => void;
  onStepBack?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onSeek?: (step: number) => void;
  onFirst?: () => void;
  onLast?: () => void;
  onSpeedChange?: (speed: number) => void;
  children?: ReactNode;
}

const TraceStepControls = forwardRef<HTMLDivElement, TraceStepControlsProps>(function TraceStepControls(
  {
    currentStep,
    totalSteps,
    playing,
    speed = 1,
    showSpeed = true,
    onStepForward,
    onStepBack,
    onPlay,
    onPause,
    onSeek,
    onFirst,
    onLast,
    onSpeedChange,
    children,
    ...rest
  },
  ref,
) {
  const [state, send] = useReducer(traceStepControlsReducer, playing ? 'playing' : 'paused');
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const rovingIndexRef = useRef(2); // initial focus: playPause (index 2)

  const atFirst = currentStep <= 0;
  const atLast = currentStep >= totalSteps - 1;
  const progressPercent = totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 0;

  // Sync internal state with external playing prop
  useEffect(() => {
    if (playing && state === 'paused') {
      send({ type: 'PLAY' });
    } else if (!playing && state === 'playing') {
      send({ type: 'PAUSE' });
    }
  }, [playing, state]);

  // Playback interval: auto-advance steps while playing
  const startPlayback = useCallback(() => {
    if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    const intervalMs = 1000 / speed;
    playIntervalRef.current = setInterval(() => {
      onStepForward?.();
    }, intervalMs);
  }, [speed, onStepForward]);

  const stopPlayback = useCallback(() => {
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    }
  }, []);

  // Start/stop playback based on state machine
  useEffect(() => {
    if (state === 'playing') {
      startPlayback();
    } else {
      stopPlayback();
    }
    return stopPlayback;
  }, [state, startPlayback, stopPlayback]);

  // Auto-pause at end of trace
  useEffect(() => {
    if (state === 'playing' && atLast) {
      send({ type: 'REACH_END' });
      onPause?.();
    }
  }, [currentStep, atLast, state, onPause]);

  // Restart interval when speed changes during playback
  useEffect(() => {
    if (state === 'playing') {
      startPlayback();
    }
  }, [speed, state, startPlayback]);

  const handlePlay = useCallback(() => {
    if (atLast) return;
    send({ type: 'PLAY' });
    onPlay?.();
  }, [atLast, onPlay]);

  const handlePause = useCallback(() => {
    send({ type: 'PAUSE' });
    onPause?.();
  }, [onPause]);

  const handleStepForward = useCallback(() => {
    if (atLast) return;
    send({ type: 'STEP_FWD' });
    onStepForward?.();
  }, [atLast, onStepForward]);

  const handleStepBack = useCallback(() => {
    if (atFirst) return;
    send({ type: 'STEP_BACK' });
    onStepBack?.();
  }, [atFirst, onStepBack]);

  const handleJumpStart = useCallback(() => {
    if (atFirst) return;
    send({ type: 'JUMP_START' });
    onFirst?.();
  }, [atFirst, onFirst]);

  const handleJumpEnd = useCallback(() => {
    if (atLast) return;
    send({ type: 'JUMP_END' });
    onLast?.();
  }, [atLast, onLast]);

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (totalSteps <= 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ratio = x / rect.width;
      const step = Math.round(ratio * (totalSteps - 1));
      const clamped = Math.max(0, Math.min(totalSteps - 1, step));
      onSeek?.(clamped);
    },
    [totalSteps, onSeek],
  );

  const handleSpeedChange = useCallback(
    (newSpeed: PlaybackSpeed) => {
      onSpeedChange?.(newSpeed);
    },
    [onSpeedChange],
  );

  // Roving tabindex for toolbar buttons
  const setRovingFocus = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(4, index));
    rovingIndexRef.current = clamped;
    buttonsRef.current[clamped]?.focus();
  }, []);

  const handleToolbarKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (state === 'playing') {
            handlePause();
          } else {
            handlePlay();
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleStepForward();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handleStepBack();
          break;
        case 'Home':
          e.preventDefault();
          handleJumpStart();
          break;
        case 'End':
          e.preventDefault();
          handleJumpEnd();
          break;
        default:
          break;
      }
    },
    [state, handlePlay, handlePause, handleStepForward, handleStepBack, handleJumpStart, handleJumpEnd],
  );

  const handleButtonKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
      // Roving tabindex within toolbar buttons
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setRovingFocus(index + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setRovingFocus(index - 1);
      }
    },
    [setRovingFocus],
  );

  const setButtonRef = (index: number) => (el: HTMLButtonElement | null) => {
    buttonsRef.current[index] = el;
  };

  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label="Trace step controls"
      data-surface-widget=""
      data-widget-name="trace-step-controls"
      data-part="root"
      data-state={state}
      onKeyDown={handleToolbarKeyDown}
      tabIndex={0}
      {...rest}
    >
      {/* Transport controls */}
      <div data-part="transport" data-state={state}>
        <button
          ref={setButtonRef(0)}
          type="button"
          data-part="jump-start"
          data-state={state}
          aria-label="Jump to start"
          aria-disabled={atFirst ? 'true' : 'false'}
          disabled={atFirst}
          tabIndex={rovingIndexRef.current === 0 ? 0 : -1}
          onClick={handleJumpStart}
          onKeyDown={(e) => handleButtonKeyDown(e, 0)}
        >
          {'\u25C4\u2502'}
        </button>

        <button
          ref={setButtonRef(1)}
          type="button"
          data-part="step-back"
          data-state={state}
          aria-label="Step backward"
          aria-disabled={atFirst ? 'true' : 'false'}
          disabled={atFirst}
          tabIndex={rovingIndexRef.current === 1 ? 0 : -1}
          onClick={handleStepBack}
          onKeyDown={(e) => handleButtonKeyDown(e, 1)}
        >
          {'\u25C4'}
        </button>

        <button
          ref={setButtonRef(2)}
          type="button"
          data-part="play-pause"
          data-state={state}
          aria-label={state === 'playing' ? 'Pause' : 'Play'}
          tabIndex={rovingIndexRef.current === 2 ? 0 : -1}
          onClick={state === 'playing' ? handlePause : handlePlay}
          onKeyDown={(e) => handleButtonKeyDown(e, 2)}
        >
          {state === 'playing' ? '\u23F8' : '\u25B6'}
        </button>

        <button
          ref={setButtonRef(3)}
          type="button"
          data-part="step-fwd"
          data-state={state}
          aria-label="Step forward"
          aria-disabled={atLast ? 'true' : 'false'}
          disabled={atLast}
          tabIndex={rovingIndexRef.current === 3 ? 0 : -1}
          onClick={handleStepForward}
          onKeyDown={(e) => handleButtonKeyDown(e, 3)}
        >
          {'\u25BA'}
        </button>

        <button
          ref={setButtonRef(4)}
          type="button"
          data-part="jump-end"
          data-state={state}
          aria-label="Jump to end"
          aria-disabled={atLast ? 'true' : 'false'}
          disabled={atLast}
          tabIndex={rovingIndexRef.current === 4 ? 0 : -1}
          onClick={handleJumpEnd}
          onKeyDown={(e) => handleButtonKeyDown(e, 4)}
        >
          {'\u2502\u25BA'}
        </button>
      </div>

      {/* Step counter */}
      <span
        data-part="step-counter"
        data-state={state}
        role="status"
        aria-live="polite"
        aria-label={`Step ${currentStep + 1} of ${totalSteps}`}
      >
        Step {currentStep + 1} of {totalSteps}
      </span>

      {/* Progress bar */}
      <div
        data-part="progress-bar"
        data-state={state}
        role="progressbar"
        aria-valuenow={currentStep + 1}
        aria-valuemin={1}
        aria-valuemax={totalSteps}
        aria-label="Trace progress"
        onClick={handleProgressClick}
        style={{ cursor: 'pointer', position: 'relative' }}
      >
        <div
          data-part="progress-fill"
          data-state={state}
          style={{
            width: `${progressPercent}%`,
            height: '100%',
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        />
      </div>

      {/* Speed control */}
      {showSpeed && (
        <div data-part="speed-control" data-state={state} data-visible="true">
          {SPEED_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              data-part="speed-option"
              data-state={state}
              data-selected={s === speed ? 'true' : 'false'}
              aria-label={`Playback speed ${s}x`}
              aria-pressed={s === speed ? 'true' : 'false'}
              onClick={() => handleSpeedChange(s)}
            >
              {s}x
            </button>
          ))}
        </div>
      )}

      {children}
    </div>
  );
});

TraceStepControls.displayName = 'TraceStepControls';
export { TraceStepControls };
export default TraceStepControls;
