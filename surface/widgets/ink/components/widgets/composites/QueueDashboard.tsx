// ============================================================
// Clef Surface Ink Widget — QueueDashboard
//
// Monitoring dashboard for background job queues displaying
// summary stats (pending, active, completed, failed), per-queue
// progress bars, and action buttons for retry and purge.
// Terminal rendering with ASCII progress indicators and
// tabular layout. Maps queue-dashboard.widget anatomy.
// See Architecture doc Section 16.
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface Queue {
  name: string;
  pending: number;
  active: number;
  completed: number;
  failed: number;
}

// --------------- Props ---------------

export interface QueueDashboardProps {
  /** Array of queues to display. */
  queues: Queue[];
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
  /** Callback when a queue is selected. */
  onSelect?: (queue: Queue) => void;
  /** Callback to retry failed jobs in a queue. */
  onRetry?: (queueName: string) => void;
  /** Callback to purge a queue. */
  onPurge?: (queueName: string) => void;
}

// --------------- Helpers ---------------

function renderProgress(completed: number, total: number, width: number): string {
  if (total === 0) return '\u2591'.repeat(width);
  const ratio = Math.min(completed / total, 1);
  const filled = Math.round(ratio * width);
  return '\u2588'.repeat(filled) + '\u2591'.repeat(width - filled);
}

// --------------- Component ---------------

type FocusTarget = { type: 'queue'; index: number } | { type: 'action'; index: number; action: 'retry' | 'purge' };

export const QueueDashboard: React.FC<QueueDashboardProps> = ({
  queues,
  isFocused = false,
  onSelect,
  onRetry,
  onPurge,
}) => {
  const [focusIndex, setFocusIndex] = useState(0);
  // Each queue has 3 focusable items: row, retry button, purge button
  const itemsPerQueue = 3;
  const totalItems = queues.length * itemsPerQueue;

  const getFocusTarget = (index: number): FocusTarget => {
    const queueIdx = Math.floor(index / itemsPerQueue);
    const subIdx = index % itemsPerQueue;
    if (subIdx === 0) return { type: 'queue', index: queueIdx };
    if (subIdx === 1) return { type: 'action', index: queueIdx, action: 'retry' };
    return { type: 'action', index: queueIdx, action: 'purge' };
  };

  useInput(
    (_input, key) => {
      if (!isFocused || queues.length === 0) return;

      if (key.downArrow) {
        setFocusIndex((i) => Math.min(i + 1, totalItems - 1));
      } else if (key.upArrow) {
        setFocusIndex((i) => Math.max(i - 1, 0));
      } else if (key.return) {
        const target = getFocusTarget(focusIndex);
        const queue = queues[target.index];
        if (!queue) return;

        if (target.type === 'queue') {
          onSelect?.(queue);
        } else if (target.action === 'retry') {
          onRetry?.(queue.name);
        } else {
          onPurge?.(queue.name);
        }
      }
    },
    { isActive: isFocused },
  );

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={isFocused ? 'cyan' : 'gray'}
      paddingX={1}
    >
      <Box marginBottom={1}>
        <Text bold>Queue Dashboard</Text>
        <Text dimColor> ({queues.length} queues)</Text>
      </Box>

      {/* Table Header */}
      <Box>
        <Box width={16}><Text bold underline>Queue</Text></Box>
        <Box width={8}><Text bold underline>Pend</Text></Box>
        <Box width={8}><Text bold underline>Act</Text></Box>
        <Box width={8}><Text bold underline>Done</Text></Box>
        <Box width={8}><Text bold underline>Fail</Text></Box>
        <Box width={14}><Text bold underline>Progress</Text></Box>
        <Box><Text bold underline>Actions</Text></Box>
      </Box>

      {/* Queue Rows */}
      {queues.map((queue, qi) => {
        const total = queue.pending + queue.active + queue.completed + queue.failed;
        const rowFocused = isFocused && Math.floor(focusIndex / itemsPerQueue) === qi;
        const target = getFocusTarget(focusIndex);
        const isQueueFocused = rowFocused && target.type === 'queue';
        const isRetryFocused = rowFocused && target.type === 'action' && target.action === 'retry';
        const isPurgeFocused = rowFocused && target.type === 'action' && target.action === 'purge';

        return (
          <Box key={queue.name}>
            <Box width={16}>
              <Text
                bold={isQueueFocused}
                color={isQueueFocused ? 'cyan' : undefined}
                wrap="truncate-end"
              >
                {queue.name}
              </Text>
            </Box>
            <Box width={8}>
              <Text color={queue.pending > 0 ? 'yellow' : undefined}>{queue.pending}</Text>
            </Box>
            <Box width={8}>
              <Text color={queue.active > 0 ? 'blue' : undefined}>{queue.active}</Text>
            </Box>
            <Box width={8}>
              <Text color="green">{queue.completed}</Text>
            </Box>
            <Box width={8}>
              <Text color={queue.failed > 0 ? 'red' : undefined}>{queue.failed}</Text>
            </Box>
            <Box width={14}>
              <Text color="green">{renderProgress(queue.completed, total, 10)}</Text>
            </Box>
            <Box>
              <Text
                bold={isRetryFocused}
                inverse={isRetryFocused}
                color={isRetryFocused ? 'yellow' : 'gray'}
              >
                [Retry]
              </Text>
              <Text> </Text>
              <Text
                bold={isPurgeFocused}
                inverse={isPurgeFocused}
                color={isPurgeFocused ? 'red' : 'gray'}
              >
                [Purge]
              </Text>
            </Box>
          </Box>
        );
      })}

      {queues.length === 0 && (
        <Text dimColor>No queues.</Text>
      )}
    </Box>
  );
};

QueueDashboard.displayName = 'QueueDashboard';
export default QueueDashboard;
