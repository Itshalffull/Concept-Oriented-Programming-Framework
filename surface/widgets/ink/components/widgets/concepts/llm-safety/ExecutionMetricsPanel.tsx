export type ExecutionMetricsPanelState = 'idle' | 'updating';
export type ExecutionMetricsPanelEvent =
  | { type: 'UPDATE' }
  | { type: 'UPDATE_COMPLETE' };

export function executionMetricsPanelReducer(state: ExecutionMetricsPanelState, event: ExecutionMetricsPanelEvent): ExecutionMetricsPanelState {
  switch (state) {
    case 'idle':
      if (event.type === 'UPDATE') return 'updating';
      return state;
    case 'updating':
      if (event.type === 'UPDATE_COMPLETE') return 'idle';
      return state;
    default:
      return state;
  }
}

import React, { useReducer } from 'react';
import { Box, Text } from 'ink';

export interface ExecutionMetricsPanelProps {
  totalTokens: number;
  totalCost: number;
  stepCount: number;
  errorRate: number;
  tokenLimit?: number | undefined;
  showLatency?: boolean;
  compact?: boolean;
  avgLatency?: number;
  p95Latency?: number;
  isFocused?: boolean;
}

export function ExecutionMetricsPanel({
  totalTokens,
  totalCost,
  stepCount,
  errorRate,
  tokenLimit,
  showLatency = false,
  compact = false,
  avgLatency,
  p95Latency,
  isFocused = false,
}: ExecutionMetricsPanelProps) {
  const [state] = useReducer(executionMetricsPanelReducer, 'idle');

  const tokenPct = tokenLimit ? Math.round((totalTokens / tokenLimit) * 100) : 0;
  const tokenColor = tokenPct > 90 ? 'red' : tokenPct > 70 ? 'yellow' : 'green';
  const errorColor = errorRate > 10 ? 'red' : errorRate > 5 ? 'yellow' : 'green';

  if (compact) {
    return (
      <Box>
        <Text color="gray">Steps:</Text><Text bold> {stepCount} </Text>
        <Text color="gray">Tokens:</Text><Text color={tokenColor} bold> {totalTokens} </Text>
        <Text color="gray">Cost:</Text><Text bold> ${totalCost.toFixed(4)} </Text>
        <Text color="gray">Errors:</Text><Text color={errorColor} bold> {errorRate.toFixed(1)}%</Text>
      </Box>
    );
  }

  const gaugeWidth = 20;
  const filled = tokenLimit ? Math.min(gaugeWidth, Math.round((totalTokens / tokenLimit) * gaugeWidth)) : 0;
  const gauge = '\u2588'.repeat(filled) + '\u2591'.repeat(gaugeWidth - filled);

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={isFocused ? 'cyan' : undefined}>
      <Text bold>Execution Metrics</Text>

      <Box flexDirection="column" marginTop={1}>
        {/* Steps */}
        <Box>
          <Text color="gray">Steps:     </Text>
          <Text bold>{stepCount}</Text>
        </Box>

        {/* Tokens */}
        <Box>
          <Text color="gray">Tokens:    </Text>
          <Text color={tokenColor} bold>{totalTokens.toLocaleString()}</Text>
          {tokenLimit && (
            <Text color="gray"> / {tokenLimit.toLocaleString()}</Text>
          )}
        </Box>
        {tokenLimit && (
          <Box paddingLeft={11}>
            <Text color={tokenColor}>{gauge}</Text>
            <Text color="gray"> {tokenPct}%</Text>
          </Box>
        )}

        {/* Cost */}
        <Box>
          <Text color="gray">Cost:      </Text>
          <Text bold>${totalCost.toFixed(4)}</Text>
        </Box>

        {/* Error rate */}
        <Box>
          <Text color="gray">Error Rate:</Text>
          <Text color={errorColor} bold> {errorRate.toFixed(1)}%</Text>
        </Box>

        {/* Latency */}
        {showLatency && (
          <Box flexDirection="column">
            {avgLatency !== undefined && (
              <Box>
                <Text color="gray">Avg Latency:</Text>
                <Text bold> {avgLatency}ms</Text>
              </Box>
            )}
            {p95Latency !== undefined && (
              <Box>
                <Text color="gray">P95 Latency:</Text>
                <Text bold> {p95Latency}ms</Text>
              </Box>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default ExecutionMetricsPanel;
