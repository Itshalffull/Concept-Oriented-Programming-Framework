// ============================================================
// Clef Surface Ink Widget — RangeSlider
//
// Dual-thumb slider for selecting a numeric range in the
// terminal. Renders as [--*====*--] 20-80 with two thumbs,
// tab to switch between thumbs, arrow keys to adjust values.
// Maps the range-slider.widget anatomy (root, label, track,
// range, thumbMin, thumbMax, outputMin, outputMax) and states
// (interaction) to keyboard-driven terminal rendering.
// ============================================================

import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Props ---------------

export interface RangeSliderProps {
  /** Minimum bound of the slider range. */
  min?: number;
  /** Maximum bound of the slider range. */
  max?: number;
  /** Step increment for thumb movement. */
  step?: number;
  /** Current lower value. */
  low?: number;
  /** Current upper value. */
  high?: number;
  /** Visible label for the slider. */
  label?: string;
  /** Disables the slider when true. */
  disabled?: boolean;
  /** Whether this component receives keyboard input. */
  isFocused?: boolean;
  /** Called when either value changes. */
  onChange?: (range: { low: number; high: number }) => void;
}

// --------------- Component ---------------

const TRACK_WIDTH = 30;

export const RangeSlider: React.FC<RangeSliderProps> = ({
  min = 0,
  max = 100,
  step = 1,
  low: controlledLow,
  high: controlledHigh,
  label,
  disabled = false,
  isFocused = false,
  onChange,
}) => {
  const [internalLow, setInternalLow] = useState(controlledLow ?? min);
  const [internalHigh, setInternalHigh] = useState(controlledHigh ?? max);
  const [activeThumb, setActiveThumb] = useState<'low' | 'high'>('low');

  const low = controlledLow !== undefined ? controlledLow : internalLow;
  const high = controlledHigh !== undefined ? controlledHigh : internalHigh;

  useEffect(() => {
    if (controlledLow !== undefined) setInternalLow(controlledLow);
  }, [controlledLow]);

  useEffect(() => {
    if (controlledHigh !== undefined) setInternalHigh(controlledHigh);
  }, [controlledHigh]);

  const clamp = useCallback(
    (v: number): number => Math.min(max, Math.max(min, v)),
    [min, max],
  );

  const emitChange = useCallback(
    (l: number, h: number) => {
      setInternalLow(l);
      setInternalHigh(h);
      onChange?.({ low: l, high: h });
    },
    [onChange],
  );

  useInput(
    (input, key) => {
      if (disabled) return;

      // Tab switches active thumb
      if (key.tab) {
        setActiveThumb((t) => (t === 'low' ? 'high' : 'low'));
        return;
      }

      const delta = key.shift ? step * 10 : step;

      if (key.rightArrow || key.upArrow) {
        if (activeThumb === 'low') {
          const next = clamp(low + delta);
          if (next <= high) emitChange(next, high);
        } else {
          const next = clamp(high + delta);
          emitChange(low, next);
        }
      } else if (key.leftArrow || key.downArrow) {
        if (activeThumb === 'low') {
          const next = clamp(low - delta);
          emitChange(next, high);
        } else {
          const next = clamp(high - delta);
          if (next >= low) emitChange(low, next);
        }
      }
    },
    { isActive: isFocused },
  );

  // Build the track visualization
  const range = max - min;
  const lowPos = range > 0 ? Math.round(((low - min) / range) * (TRACK_WIDTH - 1)) : 0;
  const highPos = range > 0 ? Math.round(((high - min) / range) * (TRACK_WIDTH - 1)) : TRACK_WIDTH - 1;

  const trackChars: string[] = [];
  for (let i = 0; i < TRACK_WIDTH; i++) {
    if (i === lowPos) {
      trackChars.push('\u25CF'); // filled circle for thumb
    } else if (i === highPos) {
      trackChars.push('\u25CF');
    } else if (i > lowPos && i < highPos) {
      trackChars.push('\u2550'); // double horizontal for range
    } else {
      trackChars.push('\u2500'); // light horizontal for track
    }
  }

  return (
    <Box flexDirection="column">
      {label && <Text bold>{label}</Text>}
      <Box>
        <Text dimColor={disabled}>{'['}</Text>
        {trackChars.map((ch, i) => {
          const isLowThumb = i === lowPos;
          const isHighThumb = i === highPos;
          const isActiveThumb =
            (isLowThumb && activeThumb === 'low') ||
            (isHighThumb && activeThumb === 'high');
          const inRange = i > lowPos && i < highPos;

          return (
            <Text
              key={i}
              bold={isLowThumb || isHighThumb}
              inverse={isActiveThumb && isFocused && !disabled}
              color={
                disabled
                  ? 'gray'
                  : isLowThumb || isHighThumb
                    ? 'cyan'
                    : inRange
                      ? 'green'
                      : undefined
              }
            >
              {ch}
            </Text>
          );
        })}
        <Text dimColor={disabled}>{']'}</Text>
        <Text bold={!disabled}>
          {' '}{low}-{high}
        </Text>
      </Box>

      {/* Active thumb indicator */}
      {isFocused && !disabled && (
        <Box>
          <Text dimColor>
            Active: {activeThumb === 'low' ? 'min' : 'max'} thumb {'|'} Tab to switch {'|'} {'\u2190\u2192'} adjust
          </Text>
        </Box>
      )}
    </Box>
  );
};

RangeSlider.displayName = 'RangeSlider';
export default RangeSlider;
