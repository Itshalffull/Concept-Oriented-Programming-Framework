/* ---------------------------------------------------------------------------
 * VoteResultBar — Ink (terminal) implementation
 * Horizontal segmented bar visualizing vote results
 * See widget spec: vote-result-bar.widget
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

import React, { useReducer, useState, useMemo, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export interface VoteSegment {
  label: string;
  count: number;
  color?: string;
}

const DEFAULT_COLORS = ['green', 'red', 'yellow', 'blue', 'magenta', 'cyan', 'white', 'gray'];

function toPercent(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, (count / total) * 100));
}

function formatPercent(value: number): string {
  const formatted = value.toFixed(1);
  return formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted;
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface VoteResultBarProps {
  segments: VoteSegment[];
  total?: number;
  variant?: 'binary' | 'multi' | 'weighted';
  showLabels?: boolean;
  showQuorum?: boolean;
  quorumThreshold?: number;
  animate?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onSegmentHover?: (index: number | null, segment: VoteSegment | null) => void;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const BAR_WIDTH = 40;

export function VoteResultBar({
  segments,
  total: totalProp,
  variant = 'binary',
  showLabels = true,
  showQuorum = false,
  quorumThreshold = 0,
  animate = true,
  size = 'md',
  onSegmentHover,
}: VoteResultBarProps) {
  const [state, send] = useReducer(voteResultBarReducer, 'idle');
  const [focusedIndex, setFocusedIndex] = useState<number>(0);

  const total = useMemo(() => {
    if (totalProp != null && totalProp > 0) return totalProp;
    return segments.reduce((sum, seg) => sum + seg.count, 0);
  }, [totalProp, segments]);

  const computedSegments = useMemo(() => {
    return segments.map((seg, i) => ({
      ...seg,
      percent: toPercent(seg.count, total),
      resolvedColor: seg.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length],
    }));
  }, [segments, total]);

  // Build the bar using block characters
  const bar = useMemo(() => {
    if (total === 0) return '\u2591'.repeat(BAR_WIDTH);
    const parts: { char: string; color: string }[] = [];
    let remaining = BAR_WIDTH;

    for (let i = 0; i < computedSegments.length; i++) {
      const seg = computedSegments[i];
      const width = i === computedSegments.length - 1
        ? remaining
        : Math.round((seg.percent / 100) * BAR_WIDTH);
      const actualWidth = Math.min(width, remaining);
      remaining -= actualWidth;

      for (let j = 0; j < actualWidth; j++) {
        parts.push({
          char: focusedIndex === i ? '\u2593' : '\u2588',
          color: seg.resolvedColor,
        });
      }
    }

    return parts;
  }, [computedSegments, total, focusedIndex]);

  // Quorum marker position
  const quorumPos = useMemo(() => {
    if (!showQuorum || quorumThreshold <= 0) return -1;
    return Math.round((quorumThreshold / 100) * BAR_WIDTH);
  }, [showQuorum, quorumThreshold]);

  useInput((input, key) => {
    if (segments.length === 0) return;

    if (key.rightArrow) {
      const next = focusedIndex < segments.length - 1 ? focusedIndex + 1 : 0;
      setFocusedIndex(next);
      send({ type: 'HOVER_SEGMENT', index: next });
      onSegmentHover?.(next, segments[next] ?? null);
    } else if (key.leftArrow) {
      const prev = focusedIndex > 0 ? focusedIndex - 1 : segments.length - 1;
      setFocusedIndex(prev);
      send({ type: 'HOVER_SEGMENT', index: prev });
      onSegmentHover?.(prev, segments[prev] ?? null);
    } else if (key.escape) {
      setFocusedIndex(-1);
      send({ type: 'UNHOVER' });
      onSegmentHover?.(null, null);
    }
  });

  return (
    <Box flexDirection="column">
      {/* Bar */}
      <Box>
        {Array.isArray(bar) ? (
          bar.map((part, i) => {
            // Insert quorum marker
            if (quorumPos === i) {
              return <Text key={i} color="white" bold>|</Text>;
            }
            return <Text key={i} color={part.color}>{part.char}</Text>;
          })
        ) : (
          <Text dimColor>{bar}</Text>
        )}
        {showQuorum && quorumThreshold > 0 && (
          <Text dimColor> Q:{quorumThreshold}%</Text>
        )}
      </Box>

      {/* Segment labels */}
      {showLabels && (
        <Box flexDirection="column">
          {computedSegments.map((seg, i) => (
            <Box key={seg.label}>
              <Text color={seg.resolvedColor}>
                {focusedIndex === i ? '\u25B6 ' : '  '}
                \u25CF {seg.label}
              </Text>
              <Text> {seg.count} ({formatPercent(seg.percent)}%)</Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Total */}
      <Box>
        <Text dimColor>Total: {total}</Text>
      </Box>

      {/* Navigation hints */}
      <Box>
        <Text dimColor>\u2190\u2192 select segment  Esc clear</Text>
      </Box>
    </Box>
  );
}

export default VoteResultBar;
