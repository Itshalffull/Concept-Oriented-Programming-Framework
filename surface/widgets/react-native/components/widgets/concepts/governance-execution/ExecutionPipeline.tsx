export type ExecutionPipelineState = 'idle' | 'stageSelected' | 'failed';
export type ExecutionPipelineEvent = | { type: 'ADVANCE' } | { type: 'SELECT_STAGE'; id?: string } | { type: 'FAIL' } | { type: 'DESELECT' } | { type: 'RETRY' } | { type: 'RESET' };

export function executionPipelineReducer(state: ExecutionPipelineState, event: ExecutionPipelineEvent): ExecutionPipelineState {
  switch (state) {
    case 'idle': if (event.type === 'ADVANCE') return 'idle'; if (event.type === 'SELECT_STAGE') return 'stageSelected'; if (event.type === 'FAIL') return 'failed'; return state;
    case 'stageSelected': if (event.type === 'DESELECT') return 'idle'; return state;
    case 'failed': if (event.type === 'RETRY' || event.type === 'RESET') return 'idle'; return state;
    default: return state;
  }
}

import React, { forwardRef, useReducer, useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';

export interface PipelineStage { id: string; name: string; status: 'pending' | 'active' | 'complete' | 'failed' | 'skipped'; duration?: number; error?: string; }

export interface ExecutionPipelineProps {
  stages: PipelineStage[]; currentStage?: string; status?: string; showTimer?: boolean; showActions?: boolean; compact?: boolean;
  onSelectStage?: (id: string | undefined) => void; onRetry?: () => void;
}

const STAGE_COLORS: Record<string, string> = { pending: '#9ca3af', active: '#3b82f6', complete: '#22c55e', failed: '#ef4444', skipped: '#d1d5db' };
const STAGE_ICONS: Record<string, string> = { pending: '\u25CB', active: '\u25CF', complete: '\u2713', failed: '\u2717', skipped: '\u2298' };

const ExecutionPipeline = forwardRef<View, ExecutionPipelineProps>(function ExecutionPipeline(
  { stages, currentStage, status = 'running', showTimer = false, compact = false, onSelectStage, onRetry }, ref,
) {
  const [state, send] = useReducer(executionPipelineReducer, 'idle');
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  const handleSelect = useCallback((id: string) => {
    const next = id === selectedId ? undefined : id;
    setSelectedId(next);
    send(next ? { type: 'SELECT_STAGE', id: next } : { type: 'DESELECT' });
    onSelectStage?.(next);
  }, [selectedId, onSelectStage]);

  const selectedStage = selectedId ? stages.find((s) => s.id === selectedId) : undefined;

  return (
    <View ref={ref} testID="execution-pipeline" accessibilityRole="none" accessibilityLabel="Execution pipeline" style={st.root}>
      <ScrollView horizontal contentContainerStyle={st.pipeline}>
        {stages.map((stage, i) => (
          <React.Fragment key={stage.id}>
            {i > 0 && <View style={[st.connector, { backgroundColor: stage.status === 'complete' ? '#22c55e' : '#d1d5db' }]} />}
            <Pressable onPress={() => handleSelect(stage.id)} accessibilityRole="button"
              accessibilityLabel={`${stage.name}: ${stage.status}`} accessibilityState={{ selected: selectedId === stage.id }}
              style={[st.stage, selectedId === stage.id && st.stageSel, compact && st.stageCompact]}>
              <Text style={[st.stageIcon, { color: STAGE_COLORS[stage.status] }]}>{STAGE_ICONS[stage.status]}</Text>
              <Text style={st.stageName} numberOfLines={1}>{stage.name}</Text>
              {showTimer && stage.duration != null && <Text style={st.stageDur}>{stage.duration}ms</Text>}
              {stage.error && <Text style={st.stageErr} numberOfLines={1}>{stage.error}</Text>}
            </Pressable>
          </React.Fragment>
        ))}
      </ScrollView>
      {selectedStage && (
        <View style={st.detail}>
          <Text style={st.detailTitle}>{selectedStage.name}</Text>
          <Text>Status: {selectedStage.status}</Text>
          {selectedStage.duration != null && <Text>Duration: {selectedStage.duration}ms</Text>}
          {selectedStage.error && <Text style={{ color: '#ef4444' }}>Error: {selectedStage.error}</Text>}
          {selectedStage.status === 'failed' && onRetry && (
            <Pressable onPress={() => { send({ type: 'RETRY' }); onRetry(); }} accessibilityRole="button" style={st.retryBtn}>
              <Text style={st.retryText}>Retry</Text></Pressable>)}
        </View>)}
    </View>);
});

const st = StyleSheet.create({
  root: { flex: 1 }, pipeline: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  connector: { width: 24, height: 2 },
  stage: { padding: 8, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, alignItems: 'center', minWidth: 80 },
  stageSel: { borderColor: '#6366f1', backgroundColor: '#eef2ff' }, stageCompact: { padding: 4, minWidth: 60 },
  stageIcon: { fontSize: 18 }, stageName: { fontSize: 12, marginTop: 2, textAlign: 'center' },
  stageDur: { fontSize: 10, color: '#6b7280' }, stageErr: { fontSize: 10, color: '#ef4444' },
  detail: { padding: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb' }, detailTitle: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  retryBtn: { marginTop: 8, backgroundColor: '#6366f1', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 4, alignSelf: 'flex-start' },
  retryText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});

ExecutionPipeline.displayName = 'ExecutionPipeline';
export { ExecutionPipeline };
export default ExecutionPipeline;
