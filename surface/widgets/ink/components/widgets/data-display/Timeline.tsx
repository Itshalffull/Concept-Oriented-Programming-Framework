// ============================================================
// Clef Surface Ink Widget — Timeline
//
// Vertical timeline visualisation displaying items as nodes
// along a time axis. Each item has a title, description,
// timestamp, and optional status. Terminal adaptation: vertical
// line with node markers, timestamps aligned left.
// See widget spec: repertoire/widgets/data-display/timeline.widget
// ============================================================

import React from 'react';
import { Box, Text } from 'ink';

// --------------- Types ---------------

export interface TimelineItem {
  id: string;
  title: string;
  description?: string;
  timestamp: string;
  status?: 'completed' | 'active' | 'pending' | 'error';
}

// --------------- Props ---------------

export interface TimelineProps {
  /** Timeline items to display in order. */
  items: TimelineItem[];
  /** Layout orientation (vertical in terminal). */
  orientation?: 'vertical' | 'horizontal';
}

// --------------- Helpers ---------------

const STATUS_MARKERS: Record<string, string> = {
  completed: '\u25CF', // ●
  active: '\u25CE',    // ◎
  pending: '\u25CB',   // ○
  error: '\u2716',     // ✖
};

const STATUS_COLORS: Record<string, string> = {
  completed: 'green',
  active: 'cyan',
  pending: 'white',
  error: 'red',
};

// --------------- Component ---------------

export const Timeline: React.FC<TimelineProps> = ({
  items,
  orientation: _orientation = 'vertical',
}) => {
  if (items.length === 0) {
    return <Text dimColor>No timeline items</Text>;
  }

  // Find max timestamp width for alignment
  const maxTimestampLen = Math.max(...items.map((item) => item.timestamp.length), 1);

  return (
    <Box flexDirection="column">
      {items.map((item, index) => {
        const status = item.status ?? 'pending';
        const marker = STATUS_MARKERS[status] ?? STATUS_MARKERS.pending;
        const color = STATUS_COLORS[status] ?? STATUS_COLORS.pending;
        const isLast = index === items.length - 1;

        return (
          <Box key={item.id} flexDirection="column">
            {/* Item row */}
            <Box>
              {/* Timestamp */}
              <Box width={maxTimestampLen + 1}>
                <Text dimColor>{item.timestamp.padEnd(maxTimestampLen, ' ')}</Text>
              </Box>

              {/* Node marker */}
              <Text color={color}> {marker} </Text>

              {/* Title */}
              <Text bold color={status === 'active' ? 'cyan' : undefined}>
                {item.title}
              </Text>
            </Box>

            {/* Description */}
            {item.description && (
              <Box>
                <Box width={maxTimestampLen + 1}>
                  <Text> </Text>
                </Box>
                <Text dimColor> {'\u2502'} </Text>
                <Text dimColor>{item.description}</Text>
              </Box>
            )}

            {/* Connector line */}
            {!isLast && (
              <Box>
                <Box width={maxTimestampLen + 1}>
                  <Text> </Text>
                </Box>
                <Text dimColor> {'\u2502'}</Text>
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
};

Timeline.displayName = 'Timeline';
export default Timeline;
