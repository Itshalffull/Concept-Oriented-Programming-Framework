// ============================================================
// Clef Surface Ink Widget — MotionBox
//
// Terminal spinner/progress component that maps Clef Surface motion
// concepts to terminal animation. Since terminals cannot render
// CSS transitions, this provides:
//
//   - Spinner animation using frame-based character cycling
//   - Progress bar with filled/empty block characters
//   - Static rendering when reduced motion is preferred
//   - Respects Clef Surface MotionTransition/MotionDuration/MotionEasing
// ============================================================

import type {
  MotionDuration,
  MotionEasing,
  MotionTransition,
} from '../../shared/types.js';
import type { TerminalNode } from './DesignTokenProvider.js';
import { hexToAnsiFg } from './DesignTokenProvider.js';

// --- ANSI Constants ---

const ANSI_RESET = '\x1b[0m';
const ANSI_BOLD = '\x1b[1m';
const ANSI_DIM = '\x1b[2m';
const ANSI_GREEN_FG = '\x1b[32m';
const ANSI_YELLOW_FG = '\x1b[33m';
const ANSI_CYAN_FG = '\x1b[36m';

// --- Spinner Frame Sets ---

export type SpinnerStyle =
  | 'dots' | 'line' | 'star' | 'hamburger'
  | 'growVertical' | 'growHorizontal'
  | 'arrow' | 'bouncingBar' | 'braille';

const SPINNER_FRAMES: Record<SpinnerStyle, string[]> = {
  dots: ['\u280b', '\u2819', '\u2839', '\u2838', '\u283c', '\u2834', '\u2826', '\u2827', '\u2807', '\u280f'],
  line: ['-', '\\', '|', '/'],
  star: ['\u2736', '\u2738', '\u2739', '\u273a', '\u2739', '\u2738'],
  hamburger: ['\u2631', '\u2632', '\u2634'],
  growVertical: ['\u2581', '\u2582', '\u2583', '\u2584', '\u2585', '\u2586', '\u2587', '\u2588', '\u2587', '\u2586', '\u2585', '\u2584', '\u2583', '\u2582'],
  growHorizontal: ['\u2589', '\u258a', '\u258b', '\u258c', '\u258d', '\u258e', '\u258f', '\u258e', '\u258d', '\u258c', '\u258b', '\u258a'],
  arrow: ['\u2190', '\u2196', '\u2191', '\u2197', '\u2192', '\u2198', '\u2193', '\u2199'],
  bouncingBar: ['[    ]', '[=   ]', '[==  ]', '[=== ]', '[ ===]', '[  ==]', '[   =]', '[    ]', '[   =]', '[  ==]', '[ ===]', '[====]', '[=== ]', '[==  ]', '[=   ]'],
  braille: ['\u2801', '\u2802', '\u2804', '\u2840', '\u2880', '\u2820', '\u2810', '\u2808'],
};

// --- Progress Bar Characters ---

const PROGRESS_FILLED = '\u2588';   // █
const PROGRESS_PARTIAL = '\u2593';  // ▓
const PROGRESS_EMPTY = '\u2591';    // ░

// --- Reduced Motion Detection ---

/**
 * Detect if reduced motion is preferred.
 * Checks environment variables and terminal settings.
 */
export function prefersReducedMotion(): boolean {
  // Check common environment indicators
  if (typeof process !== 'undefined') {
    // NO_MOTION or TERM_PROGRAM indicators
    if (process.env.REDUCE_MOTION === '1' || process.env.REDUCE_MOTION === 'true') {
      return true;
    }
    // CI environments typically prefer no animation
    if (process.env.CI === 'true' || process.env.CI === '1') {
      return true;
    }
    // Non-interactive terminals
    if (!process.stdout?.isTTY) {
      return true;
    }
  }
  return false;
}

// --- MotionBox Props ---

export interface MotionBoxProps {
  /** The type of motion visualization. */
  mode: 'spinner' | 'progress' | 'pulse' | 'static';
  /** Spinner style (when mode is 'spinner'). */
  spinnerStyle?: SpinnerStyle;
  /** Progress value 0-1 (when mode is 'progress'). */
  progress?: number;
  /** Width of progress bar in columns. */
  progressWidth?: number;
  /** Label text shown alongside the motion indicator. */
  label?: string;
  /** Whether to force static rendering (respects reduced motion). */
  reducedMotion?: boolean;
  /** Color of the spinner/progress fill (hex). */
  color?: string;
  /** Color of the progress track (hex). */
  trackColor?: string;
  /** Clef Surface motion transition reference. */
  transition?: MotionTransition;
  /** Clef Surface motion duration reference. */
  duration?: MotionDuration;
  /** Whether to show percentage text for progress. */
  showPercentage?: boolean;
  /** Custom status text. */
  statusText?: string;
  /** Children to wrap with motion state. */
  children?: (TerminalNode | string)[];
}

/**
 * Creates a MotionBox terminal node.
 *
 * Renders a spinner, progress bar, or static indicator in the terminal.
 * When reduced motion is preferred, renders a static representation.
 */
export function createMotionBox(props: MotionBoxProps): TerminalNode {
  const {
    mode,
    spinnerStyle = 'dots',
    progress = 0,
    progressWidth = 20,
    label,
    reducedMotion = prefersReducedMotion(),
    color,
    trackColor,
    transition,
    duration,
    showPercentage = true,
    statusText,
    children = [],
  } = props;

  const colorAnsi = color ? hexToAnsiFg(color) : ANSI_CYAN_FG;
  const trackAnsi = trackColor ? hexToAnsiFg(trackColor) : ANSI_DIM;
  const effectiveMode = reducedMotion && mode === 'spinner' ? 'static' : mode;

  const parts: (TerminalNode | string)[] = [];

  switch (effectiveMode) {
    case 'spinner': {
      const frames = SPINNER_FRAMES[spinnerStyle];
      // Static render shows first frame; animation is handled by MotionBoxInteractive
      const frame = frames[0];
      const spinnerText = `${colorAnsi}${frame}${ANSI_RESET}`;
      const labelText = label ? ` ${label}` : '';
      parts.push({
        type: 'text',
        props: { role: 'spinner', spinnerStyle, frameCount: frames.length },
        children: [`${spinnerText}${labelText}`],
      });
      break;
    }

    case 'progress': {
      const filled = Math.round(progress * progressWidth);
      const empty = progressWidth - filled;
      const partialFill = (progress * progressWidth) % 1 > 0.5;

      let bar = `${colorAnsi}${PROGRESS_FILLED.repeat(filled)}`;
      if (partialFill && empty > 0) {
        bar += PROGRESS_PARTIAL;
        bar += `${trackAnsi}${PROGRESS_EMPTY.repeat(empty - 1)}`;
      } else {
        bar += `${trackAnsi}${PROGRESS_EMPTY.repeat(empty)}`;
      }
      bar += ANSI_RESET;

      const percentage = showPercentage
        ? ` ${Math.round(progress * 100)}%`
        : '';
      const labelText = label ? ` ${label}` : '';
      const status = statusText ? ` ${ANSI_DIM}${statusText}${ANSI_RESET}` : '';

      parts.push({
        type: 'text',
        props: { role: 'progress', progress, width: progressWidth },
        children: [`${bar}${percentage}${labelText}${status}`],
      });
      break;
    }

    case 'pulse': {
      // Pulse renders as a blinking indicator (static shows steady)
      if (reducedMotion) {
        const indicator = `${colorAnsi}\u25cf${ANSI_RESET}`; // ●
        const labelText = label ? ` ${label}` : '';
        parts.push({
          type: 'text',
          props: { role: 'pulse-static' },
          children: [`${indicator}${labelText}`],
        });
      } else {
        const indicator = `${colorAnsi}\u25cf${ANSI_RESET}`; // ●
        const labelText = label ? ` ${label}` : '';
        parts.push({
          type: 'text',
          props: { role: 'pulse', animated: true },
          children: [`${indicator}${labelText}`],
        });
      }
      break;
    }

    case 'static': {
      const indicator = reducedMotion
        ? `${ANSI_DIM}\u25a0${ANSI_RESET}` // ■ (static square)
        : `${colorAnsi}\u2022${ANSI_RESET}`; // • (bullet)
      const labelText = label ? ` ${label}` : '';
      const status = statusText ? ` ${ANSI_DIM}(${statusText})${ANSI_RESET}` : '';
      parts.push({
        type: 'text',
        props: { role: 'static-indicator' },
        children: [`${indicator}${labelText}${status}`],
      });
      break;
    }
  }

  // Append any children
  if (children.length > 0) {
    parts.push(...children);
  }

  // Show motion metadata when transition is provided
  if (transition && !reducedMotion) {
    const durationMs = duration?.ms ?? 200;
    const meta = `${ANSI_DIM}[${transition.property} ${durationMs}ms]${ANSI_RESET}`;
    parts.push({
      type: 'text',
      props: { role: 'motion-meta' },
      children: [meta],
    });
  }

  return {
    type: 'box',
    props: {
      role: 'motion-box',
      mode: effectiveMode,
      reducedMotion,
      flexDirection: 'column',
    },
    children: parts,
  };
}

// --- Interactive MotionBox (handles animation timing) ---

export class MotionBoxInteractive {
  private frameIndex = 0;
  private progress = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<(node: TerminalNode) => void> = new Set();
  private destroyed = false;
  private props: MotionBoxProps;

  constructor(props: MotionBoxProps) {
    this.props = props;
    this.progress = props.progress ?? 0;
  }

  /** Start the spinner or pulse animation. */
  start(intervalMs = 80): void {
    if (this.destroyed) return;
    if (this.props.reducedMotion ?? prefersReducedMotion()) return;

    this.stop();
    this.intervalId = setInterval(() => {
      this.frameIndex++;
      this.notify();
    }, intervalMs);
  }

  /** Stop the animation. */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /** Update progress value (0-1). */
  setProgress(value: number): void {
    this.progress = Math.max(0, Math.min(1, value));
    this.notify();
  }

  /** Increment progress by a delta. */
  incrementProgress(delta: number): void {
    this.setProgress(this.progress + delta);
  }

  /** Check if animation is currently running. */
  isAnimating(): boolean {
    return this.intervalId !== null;
  }

  handleKey(key: string): boolean {
    // MotionBox doesn't typically handle keys, but allow stop/start
    if (key === 'space') {
      if (this.isAnimating()) {
        this.stop();
      } else {
        this.start();
      }
      return true;
    }
    return false;
  }

  /** Subscribe to re-renders. */
  onRender(listener: (node: TerminalNode) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  render(): TerminalNode {
    const { mode, spinnerStyle = 'dots', color } = this.props;
    const colorAnsi = color ? hexToAnsiFg(color) : ANSI_CYAN_FG;

    if (mode === 'spinner') {
      const frames = SPINNER_FRAMES[spinnerStyle];
      const frame = frames[this.frameIndex % frames.length];
      const labelText = this.props.label ? ` ${this.props.label}` : '';

      return {
        type: 'box',
        props: { role: 'motion-box', mode: 'spinner' },
        children: [{
          type: 'text',
          props: { role: 'spinner', frame: this.frameIndex },
          children: [`${colorAnsi}${frame}${ANSI_RESET}${labelText}`],
        }],
      };
    }

    // For progress and other modes, delegate to static renderer with current progress
    return createMotionBox({
      ...this.props,
      progress: this.progress,
    });
  }

  destroy(): void {
    this.stop();
    this.destroyed = true;
    this.listeners.clear();
  }

  private notify(): void {
    const node = this.render();
    for (const listener of this.listeners) {
      listener(node);
    }
  }
}
