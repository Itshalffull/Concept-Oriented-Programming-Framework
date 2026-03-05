export type ToolCallDetailState = 'idle' | 'retrying';
export type ToolCallDetailEvent =
  | { type: 'EXPAND_ARGS' }
  | { type: 'EXPAND_RESULT' }
  | { type: 'RETRY' }
  | { type: 'RETRY_COMPLETE' }
  | { type: 'RETRY_ERROR' };

export function toolCallDetailReducer(state: ToolCallDetailState, event: ToolCallDetailEvent): ToolCallDetailState {
  switch (state) {
    case 'idle':
      if (event.type === 'EXPAND_ARGS') return 'idle';
      if (event.type === 'EXPAND_RESULT') return 'idle';
      if (event.type === 'RETRY') return 'retrying';
      return state;
    case 'retrying':
      if (event.type === 'RETRY_COMPLETE') return 'idle';
      if (event.type === 'RETRY_ERROR') return 'idle';
      return state;
    default:
      return state;
  }
}

import React, { forwardRef, useReducer, useState, useCallback, useMemo, type ReactNode } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';

export type ToolCallStatus = 'pending' | 'success' | 'error';

export interface ToolCallDetailProps {
  toolName: string;
  input: string | Record<string, unknown>;
  output?: string | Record<string, unknown> | undefined;
  status?: ToolCallStatus;
  duration?: number | undefined;
  timestamp?: string | undefined;
  arguments?: string;
  result?: string | undefined;
  timing?: number | undefined;
  tokenUsage?: number | undefined;
  error?: string | undefined;
  showTiming?: boolean;
  showTokens?: boolean;
  onRetry?: () => void;
  onRetryComplete?: () => void;
  onRetryError?: (error: string) => void;
  children?: ReactNode;
}

function formatJson(value: string | Record<string, unknown> | undefined | null): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') {
    try { return JSON.stringify(JSON.parse(value), null, 2); }
    catch { return value; }
  }
  return JSON.stringify(value, null, 2);
}

const STATUS_STYLES: Record<ToolCallStatus, { background: string; color: string; label: string }> = {
  pending: { background: '#fef3c7', color: '#92400e', label: 'Pending' },
  success: { background: '#d1fae5', color: '#065f46', label: 'Success' },
  error: { background: '#fee2e2', color: '#991b1b', label: 'Error' },
};

const ToolCallDetail = forwardRef<View, ToolCallDetailProps>(function ToolCallDetail(
  {
    toolName, input, output, status = 'pending', duration, timestamp,
    arguments: argsProp, result, timing, tokenUsage, error,
    showTiming = true, showTokens = true, onRetry, children,
  },
  ref,
) {
  const [state, send] = useReducer(toolCallDetailReducer, 'idle');
  const [argsExpanded, setArgsExpanded] = useState(true);
  const [resultExpanded, setResultExpanded] = useState(true);

  const resolvedInput = input ?? argsProp ?? '';
  const resolvedOutput = output ?? result;
  const resolvedDuration = duration ?? timing;
  const resolvedStatus: ToolCallStatus = error ? 'error' : status;

  const formattedInput = useMemo(() => formatJson(resolvedInput), [resolvedInput]);
  const formattedOutput = useMemo(() => formatJson(resolvedOutput), [resolvedOutput]);
  const errorMessage = error ?? (resolvedStatus === 'error' && typeof resolvedOutput === 'string' ? resolvedOutput : undefined);
  const statusInfo = STATUS_STYLES[resolvedStatus];

  const handleRetry = useCallback(() => {
    if (state === 'retrying') return;
    send({ type: 'RETRY' });
    onRetry?.();
  }, [state, onRetry]);

  const handleToggleArgs = useCallback(() => {
    setArgsExpanded((prev) => !prev);
    send({ type: 'EXPAND_ARGS' });
  }, []);

  const handleToggleResult = useCallback(() => {
    setResultExpanded((prev) => !prev);
    send({ type: 'EXPAND_RESULT' });
  }, []);

  return (
    <View ref={ref} testID="tool-call-detail" accessibilityRole="none" accessibilityLabel={`Tool call: ${toolName}`} style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.toolName}>{toolName}</Text>
        <View style={[s.statusBadge, { backgroundColor: statusInfo.background }]}>
          <Text style={[s.statusText, { color: statusInfo.color }]} accessibilityLabel={`Status: ${statusInfo.label}`}>
            {statusInfo.label}
          </Text>
        </View>
        {resolvedDuration !== undefined && showTiming && (
          <Text style={s.timing}>{resolvedDuration}ms</Text>
        )}
      </View>

      {/* Input section */}
      <View style={s.section}>
        <Pressable onPress={handleToggleArgs} accessibilityRole="button" accessibilityState={{ expanded: argsExpanded }} style={s.sectionHeader}>
          <Text style={s.sectionArrow}>{argsExpanded ? '\u25BC' : '\u25B6'}</Text>
          <Text style={s.sectionTitle}>Input</Text>
        </Pressable>
        {argsExpanded && (
          <ScrollView horizontal style={s.codeBlock}>
            <Text style={s.codeText} accessibilityLabel="Arguments">{formattedInput}</Text>
          </ScrollView>
        )}
      </View>

      {/* Output section */}
      {(resolvedOutput !== undefined || errorMessage) && (
        <View style={s.section}>
          <Pressable onPress={handleToggleResult} accessibilityRole="button" accessibilityState={{ expanded: resultExpanded }} style={s.sectionHeader}>
            <Text style={s.sectionArrow}>{resultExpanded ? '\u25BC' : '\u25B6'}</Text>
            <Text style={s.sectionTitle}>Output</Text>
          </Pressable>
          {resultExpanded && (
            resolvedStatus === 'error' && errorMessage ? (
              <View style={s.errorBlock} accessibilityRole="alert" accessibilityLabel="Error details">
                <Text style={s.errorText}>{errorMessage}</Text>
              </View>
            ) : (
              <ScrollView horizontal style={s.codeBlock}>
                <Text style={s.codeText} accessibilityLabel="Result">{formattedOutput}</Text>
              </ScrollView>
            )
          )}
        </View>
      )}

      {/* Token usage badge */}
      {showTokens && tokenUsage !== undefined && (
        <View style={s.tokenBadge}>
          <Text style={s.tokenText}>{tokenUsage} tokens</Text>
        </View>
      )}

      {/* Timestamp */}
      {timestamp && (
        <Text style={s.timestamp}>{timestamp}</Text>
      )}

      {/* Retry button */}
      {errorMessage && (
        <Pressable
          onPress={handleRetry}
          accessibilityRole="button"
          accessibilityLabel="Retry tool call"
          accessibilityState={{ disabled: state === 'retrying' }}
          disabled={state === 'retrying'}
          style={[s.retryButton, state === 'retrying' && s.retryButtonDisabled]}
        >
          <Text style={s.retryText}>{state === 'retrying' ? 'Retrying...' : (children ? undefined : 'Retry')}</Text>
          {children}
        </Pressable>
      )}
    </View>
  );
});

const s = StyleSheet.create({
  root: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, overflow: 'hidden', backgroundColor: '#ffffff' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  toolName: { fontWeight: '600', fontFamily: 'monospace', fontSize: 14 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999 },
  statusText: { fontSize: 12, fontWeight: '500' },
  timing: { marginLeft: 'auto' as any, fontSize: 12, color: '#6b7280' },
  section: { borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8 },
  sectionArrow: { fontSize: 10, color: '#374151' },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#374151' },
  codeBlock: { paddingHorizontal: 12, paddingBottom: 8, backgroundColor: '#f9fafb' },
  codeText: { fontSize: 12, fontFamily: 'monospace', color: '#1f2937' },
  errorBlock: { padding: 8, marginHorizontal: 12, marginBottom: 8, backgroundColor: '#fef2f2', borderLeftWidth: 3, borderLeftColor: '#ef4444', borderRadius: 4 },
  errorText: { fontSize: 12, fontFamily: 'monospace', color: '#991b1b' },
  tokenBadge: { alignSelf: 'flex-start', margin: 8, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 9999 },
  tokenText: { fontSize: 12, color: '#6b7280' },
  timestamp: { paddingHorizontal: 12, paddingBottom: 8, fontSize: 12, color: '#9ca3af' },
  retryButton: { alignSelf: 'flex-start', margin: 12, paddingVertical: 6, paddingHorizontal: 14, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, backgroundColor: '#ffffff' },
  retryButtonDisabled: { backgroundColor: '#f3f4f6' },
  retryText: { fontSize: 13, fontWeight: '500', color: '#374151' },
});

ToolCallDetail.displayName = 'ToolCallDetail';
export { ToolCallDetail };
export default ToolCallDetail;
