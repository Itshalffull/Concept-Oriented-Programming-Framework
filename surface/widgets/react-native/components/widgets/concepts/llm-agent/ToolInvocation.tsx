export type ToolInvocationViewState = 'collapsed' | 'hoveredCollapsed' | 'expanded';
export type ToolInvocationExecState = 'pending' | 'running' | 'succeeded' | 'failed';

export type ToolInvocationViewEvent =
  | { type: 'EXPAND' }
  | { type: 'COLLAPSE' }
  | { type: 'HOVER' }
  | { type: 'LEAVE' };

export type ToolInvocationExecEvent =
  | { type: 'INVOKE' }
  | { type: 'SUCCESS' }
  | { type: 'FAILURE' }
  | { type: 'RETRY' }
  | { type: 'RESET' };

export function viewReducer(state: ToolInvocationViewState, event: ToolInvocationViewEvent): ToolInvocationViewState {
  switch (state) {
    case 'collapsed':
      if (event.type === 'EXPAND') return 'expanded';
      if (event.type === 'HOVER') return 'hoveredCollapsed';
      return state;
    case 'hoveredCollapsed':
      if (event.type === 'LEAVE') return 'collapsed';
      if (event.type === 'EXPAND') return 'expanded';
      return state;
    case 'expanded':
      if (event.type === 'COLLAPSE') return 'collapsed';
      return state;
    default:
      return state;
  }
}

export function execReducer(state: ToolInvocationExecState, event: ToolInvocationExecEvent): ToolInvocationExecState {
  switch (state) {
    case 'pending':
      if (event.type === 'INVOKE') return 'running';
      return state;
    case 'running':
      if (event.type === 'SUCCESS') return 'succeeded';
      if (event.type === 'FAILURE') return 'failed';
      return state;
    case 'succeeded':
      if (event.type === 'RESET') return 'pending';
      return state;
    case 'failed':
      if (event.type === 'RETRY') return 'running';
      if (event.type === 'RESET') return 'pending';
      return state;
    default:
      return state;
  }
}

import React, { forwardRef, useCallback, useEffect, useMemo, useReducer } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';

export interface ToolInvocationProps {
  toolName: string;
  arguments: string;
  result?: string | undefined;
  status: string;
  duration?: number | undefined;
  onRetry?: () => void;
  defaultExpanded?: boolean;
  showArguments?: boolean;
  showResult?: boolean;
  destructive?: boolean;
}

function formatJson(raw: string): string {
  try { return JSON.stringify(JSON.parse(raw), null, 2); } catch { return raw; }
}

function statusToExecState(status: string): ToolInvocationExecState {
  switch (status) {
    case 'running': return 'running';
    case 'succeeded': return 'succeeded';
    case 'failed': return 'failed';
    default: return 'pending';
  }
}

const STATUS_ICONS: Record<ToolInvocationExecState, string> = {
  running: '\u25CB',
  succeeded: '\u2713',
  failed: '\u2717',
  pending: '\u2022',
};

const STATUS_COLORS: Record<ToolInvocationExecState, string> = {
  running: '#3b82f6',
  succeeded: '#22c55e',
  failed: '#ef4444',
  pending: '#9ca3af',
};

const ToolInvocation = forwardRef<View, ToolInvocationProps>(function ToolInvocation(
  { toolName, arguments: args, result, status, duration, onRetry, defaultExpanded = false, showArguments = true, showResult = true, destructive = false },
  ref,
) {
  const [viewState, sendView] = useReducer(viewReducer, defaultExpanded ? 'expanded' : 'collapsed');
  const [execState, sendExec] = useReducer(execReducer, statusToExecState(status));

  useEffect(() => {
    const mapped = statusToExecState(status);
    if (mapped === 'running') sendExec({ type: 'INVOKE' });
    else if (mapped === 'succeeded') sendExec({ type: 'SUCCESS' });
    else if (mapped === 'failed') sendExec({ type: 'FAILURE' });
    else sendExec({ type: 'RESET' });
  }, [status]);

  const isExpanded = viewState === 'expanded';

  const toggleExpand = useCallback(() => {
    if (isExpanded) sendView({ type: 'COLLAPSE' });
    else sendView({ type: 'EXPAND' });
  }, [isExpanded]);

  const handleRetry = useCallback(() => {
    sendExec({ type: 'RETRY' });
    onRetry?.();
  }, [onRetry]);

  const formattedArgs = useMemo(() => formatJson(args), [args]);
  const formattedResult = useMemo(() => (result ? formatJson(result) : undefined), [result]);

  const statusLabel = execState === 'running' ? 'Running' : execState === 'succeeded' ? 'Succeeded' : execState === 'failed' ? 'Failed' : 'Pending';

  return (
    <View ref={ref} testID="tool-invocation" accessibilityRole="none" accessibilityLabel={`Tool call: ${toolName}`} style={s.root}>
      <Pressable onPress={toggleExpand} onPressIn={() => sendView({ type: 'HOVER' })} onPressOut={() => sendView({ type: 'LEAVE' })}
        accessibilityRole="button" accessibilityLabel={`${toolName} \u2014 ${statusLabel}`}
        accessibilityState={{ expanded: isExpanded }} style={s.header}>
        <Text style={s.gearIcon}>{'\u2699'}</Text>
        <Text style={s.toolName}>{toolName}</Text>
        {destructive && <Text style={s.warningBadge}>{'\u26A0'}</Text>}
        <Text style={[s.statusIcon, { color: STATUS_COLORS[execState] }]}>{STATUS_ICONS[execState]}</Text>
        {duration != null && <Text style={s.duration}>{`${duration}ms`}</Text>}
      </Pressable>
      {isExpanded && (
        <View style={s.body}>
          {showArguments && (
            <View style={s.codeBlock}>
              <Text style={s.codeLabel}>Arguments</Text>
              <ScrollView horizontal style={s.codeScroll}>
                <Text style={s.codeText}>{formattedArgs}</Text>
              </ScrollView>
            </View>
          )}
          {showResult && formattedResult && (
            <View style={s.codeBlock}>
              <Text style={s.codeLabel}>Result</Text>
              <ScrollView horizontal style={s.codeScroll}>
                <Text style={s.codeText}>{formattedResult}</Text>
              </ScrollView>
            </View>
          )}
          {execState === 'failed' && onRetry && (
            <Pressable onPress={handleRetry} accessibilityRole="button" accessibilityLabel="Retry tool call" style={s.retryBtn}>
              <Text style={s.retryText}>Retry</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
});

const s = StyleSheet.create({
  root: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 10, gap: 8 },
  gearIcon: { fontSize: 16, color: '#6b7280' },
  toolName: { fontSize: 13, fontWeight: '600', fontFamily: 'monospace', flex: 1 },
  warningBadge: { fontSize: 14, color: '#eab308' },
  statusIcon: { fontSize: 14 },
  duration: { fontSize: 11, color: '#9ca3af' },
  body: { borderTopWidth: 1, borderTopColor: '#e5e7eb', padding: 12, gap: 12 },
  codeBlock: { gap: 4 },
  codeLabel: { fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' },
  codeScroll: { backgroundColor: '#f9fafb', borderRadius: 4, padding: 8 },
  codeText: { fontSize: 12, fontFamily: 'monospace', lineHeight: 18 },
  retryBtn: { backgroundColor: '#ef4444', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 4, alignSelf: 'flex-start' },
  retryText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});

ToolInvocation.displayName = 'ToolInvocation';
export { ToolInvocation };
export default ToolInvocation;
