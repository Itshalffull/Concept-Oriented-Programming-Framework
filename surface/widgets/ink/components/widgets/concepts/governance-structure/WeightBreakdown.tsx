/* ---------------------------------------------------------------------------
 * WeightBreakdown — Ink (terminal) implementation
 * Stacked bar chart showing weight source composition
 * See widget spec: weight-breakdown.widget
 * ------------------------------------------------------------------------- */

export type WeightBreakdownState = 'idle' | 'segmentHovered';
export type WeightBreakdownEvent =
  | { type: 'HOVER_SEGMENT'; source: string }
  | { type: 'LEAVE' };

export function weightBreakdownReducer(state: WeightBreakdownState, event: WeightBreakdownEvent): WeightBreakdownState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER_SEGMENT') return 'segmentHovered';
      return state;
    case 'segmentHovered':
      if (event.type === 'LEAVE') return 'idle';
      return state;
    default:
      return state;
  }
}

import React, { useReducer, useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export type WeightSourceType = 'token' | 'delegation' | 'reputation' | 'manual';

export interface WeightSource {
  label: string;
  weight: number;
  type: WeightSourceType;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

const SOURCE_COLORS: Record<WeightSourceType, string> = {
  token: 'blue',
  delegation: 'magenta',
  reputation: 'green',
  manual: 'yellow',
};

const SOURCE_CHARS: Record<WeightSourceType, string> = {
  token: '\u2588',
  delegation: '\u2593',
  reputation: '\u2592',
  manual: '\u2591',
};

function formatWeight(value: number): string {
  return Number(value.toFixed(2)).toString();
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface WeightBreakdownProps {
  sources: WeightSource[];
  totalWeight: number;
  participant: string;
  variant?: 'bar' | 'donut';
  showLegend?: boolean;
  showTotal?: boolean;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const BAR_WIDTH = 40;

export function WeightBreakdown({
  sources,
  totalWeight,
  participant,
  variant = 'bar',
  showLegend = true,
  showTotal = true,
}: WeightBreakdownProps) {
  const [state, send] = useReducer(weightBreakdownReducer, 'idle');
  const [focusedIndex, setFocusedIndex] = useState<number>(0);

  const segments = useMemo(() => {
    const sorted = [...sources].sort((a, b) => b.weight - a.weight);
    return sorted.map((source) => ({
      ...source,
      percent: totalWeight > 0 ? (source.weight / totalWeight) * 100 : 0,
    }));
  }, [sources, totalWeight]);

  // Build stacked bar
  const bar = useMemo(() => {
    if (totalWeight === 0) return [{ char: '\u2591'.repeat(BAR_WIDTH), color: 'gray' }];
    const parts: { char: string; color: string }[] = [];
    let remaining = BAR_WIDTH;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const width = i === segments.length - 1
        ? remaining
        : Math.round((seg.percent / 100) * BAR_WIDTH);
      const actualWidth = Math.min(width, remaining);
      remaining -= actualWidth;

      const isHighlighted = focusedIndex === i;
      for (let j = 0; j < actualWidth; j++) {
        parts.push({
          char: isHighlighted ? SOURCE_CHARS[seg.type] : '\u2588',
          color: SOURCE_COLORS[seg.type],
        });
      }
    }

    return parts;
  }, [segments, totalWeight, focusedIndex]);

  useInput((input, key) => {
    if (segments.length === 0) return;

    if (key.rightArrow || key.downArrow) {
      const next = focusedIndex < segments.length - 1 ? focusedIndex + 1 : 0;
      setFocusedIndex(next);
      send({ type: 'HOVER_SEGMENT', source: segments[next].label });
    } else if (key.leftArrow || key.upArrow) {
      const prev = focusedIndex > 0 ? focusedIndex - 1 : segments.length - 1;
      setFocusedIndex(prev);
      send({ type: 'HOVER_SEGMENT', source: segments[prev].label });
    } else if (key.escape) {
      setFocusedIndex(-1);
      send({ type: 'LEAVE' });
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round">
      {/* Header */}
      <Box>
        <Text bold>Weight Breakdown</Text>
        <Text dimColor> - {participant}</Text>
      </Box>

      {/* Total */}
      {showTotal && (
        <Box>
          <Text bold>Total: {formatWeight(totalWeight)}</Text>
        </Box>
      )}

      {/* Bar chart */}
      <Box>
        {bar.map((part, i) => (
          <Text key={i} color={part.color}>{part.char}</Text>
        ))}
      </Box>

      {/* Legend */}
      {showLegend && (
        <Box flexDirection="column">
          {segments.map((seg, i) => (
            <Box key={seg.label}>
              <Text color={SOURCE_COLORS[seg.type]}>
                {focusedIndex === i ? '\u25B6 ' : '  '}
                \u25CF {seg.label}
              </Text>
              <Text dimColor> [{seg.type}]</Text>
              <Text> {formatWeight(seg.weight)} ({formatWeight(seg.percent)}%)</Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Focused segment detail */}
      {state === 'segmentHovered' && focusedIndex >= 0 && segments[focusedIndex] && (
        <Box>
          <Text bold color={SOURCE_COLORS[segments[focusedIndex].type]}>
            {segments[focusedIndex].label}: {formatWeight(segments[focusedIndex].weight)} ({formatWeight(segments[focusedIndex].percent)}%)
          </Text>
        </Box>
      )}

      <Box>
        <Text dimColor>\u2190\u2192 select segment  Esc clear</Text>
      </Box>
    </Box>
  );
}

export default WeightBreakdown;
