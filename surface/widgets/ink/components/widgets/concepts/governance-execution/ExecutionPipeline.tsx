/* ---------------------------------------------------------------------------
 * ExecutionPipeline — Ink (terminal) implementation
 * Horizontal pipeline visualization showing governance execution stages
 * See widget spec: execution-pipeline.widget
 * ------------------------------------------------------------------------- */

export type ExecutionPipelineState = 'idle' | 'stageSelected' | 'failed';
export type ExecutionPipelineEvent =
  | { type: 'ADVANCE' }
  | { type: 'SELECT_STAGE'; stageId?: string }
  | { type: 'FAIL' }
  | { type: 'DESELECT' }
  | { type: 'RETRY' }
  | { type: 'RESET' };

export function executionPipelineReducer(state: ExecutionPipelineState, event: ExecutionPipelineEvent): ExecutionPipelineState {
  switch (state) {
    case 'idle':
      if (event.type === 'ADVANCE') return 'idle';
      if (event.type === 'SELECT_STAGE') return 'stageSelected';
      if (event.type === 'FAIL') return 'failed';
      return state;
    case 'stageSelected':
      if (event.type === 'DESELECT') return 'idle';
      return state;
    case 'failed':
      if (event.type === 'RETRY') return 'idle';
      if (event.type === 'RESET') return 'idle';
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

export type PipelineStageStatus = 'pending' | 'active' | 'complete' | 'failed' | 'skipped';

export interface PipelineStage {
  id: string;
  name: string;
  status: PipelineStageStatus;
  description?: string;
  isTimelock?: boolean;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

const STATUS_ICONS: Record<PipelineStageStatus, string> = {
  complete: '\u2713',
  failed: '\u2717',
  active: '\u25CF',
  pending: '\u25CB',
  skipped: '\u2298',
};

const STATUS_COLORS: Record<PipelineStageStatus, string> = {
  complete: 'green',
  failed: 'red',
  active: 'cyan',
  pending: 'gray',
  skipped: 'yellow',
};

function connectorChar(left: PipelineStageStatus, right: PipelineStageStatus): string {
  if (left === 'complete' && (right === 'complete' || right === 'active')) return '\u2500\u2500\u25B6';
  if (left === 'failed' || right === 'failed') return '\u2500\u2500\u2717';
  return '\u2500\u2500\u25B7';
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface ExecutionPipelineProps {
  stages: PipelineStage[];
  currentStage: string;
  status: string;
  showTimer?: boolean;
  showActions?: boolean;
  compact?: boolean;
  onStageSelect?: (stageId: string) => void;
  onRetry?: () => void;
  onCancel?: () => void;
  onForceExecute?: () => void;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export function ExecutionPipeline({
  stages,
  currentStage,
  status,
  showTimer = true,
  showActions = true,
  compact = false,
  onStageSelect,
  onRetry,
  onCancel,
  onForceExecute,
}: ExecutionPipelineProps) {
  const [widgetState, send] = useReducer(executionPipelineReducer, 'idle');
  const [focusIndex, setFocusIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const activeIndex = useMemo(
    () => stages.findIndex((s) => s.id === currentStage),
    [stages, currentStage],
  );

  const isFailed = status === 'failed' || widgetState === 'failed';
  const hasActiveTimelock = useMemo(
    () => stages.some((s) => s.isTimelock && s.status === 'active'),
    [stages],
  );

  const selectedStage = selectedIndex >= 0 ? stages[selectedIndex] : null;

  useInput((input, key) => {
    if (key.rightArrow) {
      setFocusIndex((i) => Math.min(i + 1, stages.length - 1));
    } else if (key.leftArrow) {
      setFocusIndex((i) => Math.max(i - 1, 0));
    } else if (key.return) {
      setSelectedIndex(focusIndex);
      send({ type: 'SELECT_STAGE', stageId: stages[focusIndex]?.id });
      if (stages[focusIndex]) onStageSelect?.(stages[focusIndex].id);
    } else if (key.escape) {
      setSelectedIndex(-1);
      send({ type: 'DESELECT' });
    } else if (input === 'r' && isFailed) {
      send({ type: 'RETRY' });
      onRetry?.();
    } else if (input === 'c' && onCancel) {
      onCancel();
    } else if (input === 'f' && onForceExecute) {
      onForceExecute();
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round">
      {/* Header */}
      <Box>
        <Text bold>Execution Pipeline</Text>
        <Text> </Text>
        <Text color={isFailed ? 'red' : status === 'complete' ? 'green' : 'cyan'}>
          [{status.toUpperCase()}]
        </Text>
      </Box>

      {/* Pipeline stages - horizontal */}
      <Box>
        {stages.map((stage, index) => {
          const isCurrent = stage.id === currentStage;
          const isFocused = focusIndex === index;
          const isSelected = selectedIndex === index;

          return (
            <Box key={stage.id}>
              <Text
                color={STATUS_COLORS[stage.status]}
                bold={isCurrent}
                inverse={isSelected}
              >
                {isFocused ? '\u25B6' : ' '}
                {STATUS_ICONS[stage.status]}
                {compact ? '' : ` ${stage.name}`}
              </Text>
              {index < stages.length - 1 && (
                <Text dimColor>{connectorChar(stage.status, stages[index + 1].status)}</Text>
              )}
            </Box>
          );
        })}
      </Box>

      {/* Stage names below if compact */}
      {compact && (
        <Box>
          {stages.map((stage, index) => (
            <Box key={stage.id} width={10}>
              <Text dimColor wrap="truncate">
                {focusIndex === index ? '\u25B6' : ' '}{stage.name}
              </Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Detail panel for selected stage */}
      {widgetState === 'stageSelected' && selectedStage && (
        <Box flexDirection="column" marginTop={1} borderStyle="single" paddingX={1}>
          <Box>
            <Text bold>{selectedStage.name}</Text>
            <Text> </Text>
            <Text color={STATUS_COLORS[selectedStage.status]}>
              [{selectedStage.status}]
            </Text>
          </Box>
          {selectedStage.description && (
            <Box><Text dimColor>{selectedStage.description}</Text></Box>
          )}
        </Box>
      )}

      {/* Timelock indicator */}
      {showTimer && hasActiveTimelock && (
        <Box>
          <Text color="yellow">\u23F0 Timelock countdown active</Text>
        </Box>
      )}

      {/* Failure banner */}
      {isFailed && (
        <Box>
          <Text color="red" bold>\u26A0 Pipeline execution failed</Text>
          {onRetry && <Text dimColor> (r to retry)</Text>}
        </Box>
      )}

      {/* Action hints */}
      {showActions && (
        <Box>
          <Text dimColor>
            \u2190\u2192 navigate  Enter select  Esc deselect
            {onCancel ? '  c cancel' : ''}
            {onForceExecute ? '  f force' : ''}
          </Text>
        </Box>
      )}
    </Box>
  );
}

export default ExecutionPipeline;
