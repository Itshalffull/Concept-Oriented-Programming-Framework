// ============================================================
// Clef Surface Ink Widget — MotionBox
//
// Terminal spinner/progress component using Ink. Maps Clef
// Surface motion concepts to terminal animation:
//
//   - Spinner: frame-based character cycling via useEffect
//   - Progress bar: filled/empty block characters
//   - Pulse: blinking indicator
//   - Static: non-animated fallback
//   - Respects reduced motion preferences
// ============================================================

import React, { useState, useEffect, useCallback, type ReactNode } from 'react';
import { Box, Text, useInput } from 'ink';

import type { MotionTransition, MotionDuration } from '../../shared/types.js';

// --------------- Spinner Frame Sets ---------------

export type SpinnerStyle =
  | 'dots' | 'line' | 'star' | 'hamburger'
  | 'growVertical' | 'growHorizontal'
  | 'arrow' | 'bouncingBar' | 'braille';

const SPINNER_FRAMES: Record<SpinnerStyle, string[]> = {
  dots: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  line: ['-', '\\', '|', '/'],
  star: ['✶', '✸', '✹', '✺', '✹', '✸'],
  hamburger: ['☱', '☲', '☴'],
  growVertical: ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█', '▇', '▆', '▅', '▄', '▃', '▂'],
  growHorizontal: ['▉', '▊', '▋', '▌', '▍', '▎', '▏', '▎', '▍', '▌', '▋', '▊'],
  arrow: ['←', '↖', '↑', '↗', '→', '↘', '↓', '↙'],
  bouncingBar: ['[    ]', '[=   ]', '[==  ]', '[=== ]', '[ ===]', '[  ==]', '[   =]', '[    ]', '[   =]', '[  ==]', '[ ===]', '[====]', '[=== ]', '[==  ]', '[=   ]'],
  braille: ['⠁', '⠂', '⠄', '⡀', '⢀', '⠠', '⠐', '⠈'],
};

// --------------- Reduced Motion Detection ---------------

function prefersReducedMotion(): boolean {
  if (typeof process !== 'undefined') {
    if (process.env.REDUCE_MOTION === '1' || process.env.REDUCE_MOTION === 'true') return true;
    if (process.env.CI === 'true' || process.env.CI === '1') return true;
    if (!process.stdout?.isTTY) return true;
  }
  return false;
}

// --------------- Props ---------------

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
  /** Color of the spinner/progress fill. */
  color?: string;
  /** Color of the progress track. */
  trackColor?: string;
  /** Clef Surface motion transition reference. */
  transition?: MotionTransition;
  /** Clef Surface motion duration reference. */
  duration?: MotionDuration;
  /** Whether to show percentage text for progress. */
  showPercentage?: boolean;
  /** Custom status text. */
  statusText?: string;
  /** Whether this component is focused. */
  isFocused?: boolean;
  /** Children to wrap with motion state. */
  children?: ReactNode;
}

// --------------- Component ---------------

export const MotionBox: React.FC<MotionBoxProps> = ({
  mode,
  spinnerStyle = 'dots',
  progress = 0,
  progressWidth = 20,
  label,
  reducedMotion = prefersReducedMotion(),
  color = 'cyan',
  trackColor,
  transition,
  duration,
  showPercentage = true,
  statusText,
  isFocused = false,
  children,
}) => {
  const [frameIndex, setFrameIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(true);

  const effectiveMode = reducedMotion && mode === 'spinner' ? 'static' : mode;

  // Animate spinner/pulse
  useEffect(() => {
    if (effectiveMode !== 'spinner' && effectiveMode !== 'pulse') return;
    if (!isRunning || reducedMotion) return;

    const intervalMs = effectiveMode === 'pulse' ? 500 : 80;
    const id = setInterval(() => {
      setFrameIndex((i) => i + 1);
    }, intervalMs);

    return () => clearInterval(id);
  }, [effectiveMode, isRunning, reducedMotion]);

  // Toggle animation on space
  useInput(
    (input) => {
      if (input === ' ') {
        setIsRunning((r) => !r);
      }
    },
    { isActive: isFocused },
  );

  const renderIndicator = () => {
    switch (effectiveMode) {
      case 'spinner': {
        const frames = SPINNER_FRAMES[spinnerStyle];
        const frame = frames[frameIndex % frames.length];
        return (
          <Box>
            <Text color={color}>{frame}</Text>
            {label && <Text> {label}</Text>}
          </Box>
        );
      }

      case 'progress': {
        const filled = Math.round(progress * progressWidth);
        const empty = progressWidth - filled;
        const pct = Math.round(progress * 100);

        return (
          <Box>
            <Text color={color}>{'█'.repeat(filled)}</Text>
            <Text dimColor>{'░'.repeat(empty)}</Text>
            {showPercentage && <Text> {pct}%</Text>}
            {label && <Text> {label}</Text>}
            {statusText && <Text dimColor> {statusText}</Text>}
          </Box>
        );
      }

      case 'pulse': {
        const visible = frameIndex % 2 === 0;
        return (
          <Box>
            <Text color={color}>{visible ? '●' : ' '}</Text>
            {label && <Text> {label}</Text>}
          </Box>
        );
      }

      case 'static': {
        return (
          <Box>
            <Text dimColor>■</Text>
            {label && <Text> {label}</Text>}
            {statusText && <Text dimColor> ({statusText})</Text>}
          </Box>
        );
      }
    }
  };

  return (
    <Box flexDirection="column">
      {renderIndicator()}
      {children}
      {transition && !reducedMotion && (
        <Text dimColor>
          [{transition.property} {duration?.ms ?? 200}ms]
        </Text>
      )}
    </Box>
  );
};

MotionBox.displayName = 'MotionBox';
export default MotionBox;
