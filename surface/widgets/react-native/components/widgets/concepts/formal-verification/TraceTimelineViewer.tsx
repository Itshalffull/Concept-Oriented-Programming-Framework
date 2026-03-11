export type TraceTimelineViewerState = 'idle' | 'playing' | 'cellSelected';
export type TraceTimelineViewerEvent =
  | { type: 'PLAY' }
  | { type: 'STEP_FORWARD' }
  | { type: 'STEP_BACKWARD' }
  | { type: 'SELECT_CELL' }
  | { type: 'ZOOM' }
  | { type: 'PAUSE' }
  | { type: 'STEP_END' }
  | { type: 'DESELECT' };

export function traceTimelineViewerReducer(state: TraceTimelineViewerState, event: TraceTimelineViewerEvent): TraceTimelineViewerState {
  switch (state) {
    case 'idle':
      if (event.type === 'PLAY') return 'playing';
      if (event.type === 'STEP_FORWARD') return 'idle';
      if (event.type === 'STEP_BACKWARD') return 'idle';
      if (event.type === 'SELECT_CELL') return 'cellSelected';
      if (event.type === 'ZOOM') return 'idle';
      return state;
    case 'playing':
      if (event.type === 'PAUSE') return 'idle';
      if (event.type === 'STEP_END') return 'idle';
      return state;
    case 'cellSelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'SELECT_CELL') return 'cellSelected';
      return state;
    default:
      return state;
  }
}

import React, { forwardRef, useReducer, useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';

export interface TraceStep {
  index: number;
  label: string;
  state: Record<string, string>;
  isError?: boolean;
  timestamp?: string;
}

export interface TraceTimelineViewerProps {
  steps: TraceStep[];
  variables?: string[];
  currentStep?: number;
  playbackSpeed?: number;
  showChangesOnly?: boolean;
  zoom?: number;
  onStepChange?: (stepIndex: number) => void;
  children?: React.ReactNode;
}

const TraceTimelineViewer = forwardRef<View, TraceTimelineViewerProps>(function TraceTimelineViewer(
  { steps, variables: variablesProp, currentStep: controlledStep, playbackSpeed = 1.0, showChangesOnly = false, zoom = 1.0, onStepChange, children },
  ref,
) {
  const [widgetState, send] = useReducer(traceTimelineViewerReducer, 'idle');
  const variables: string[] = variablesProp ?? (() => {
    const keys = new Set<string>();
    for (const step of steps) for (const k of Object.keys(step.state)) keys.add(k);
    return Array.from(keys);
  })();

  const [internalStep, setInternalStep] = useState(0);
  const activeStep = controlledStep ?? internalStep;
  const goToStep = useCallback((idx: number) => {
    const clamped = Math.max(0, Math.min(idx, steps.length - 1));
    setInternalStep(clamped);
    onStepChange?.(clamped);
  }, [steps.length, onStepChange]);

  useEffect(() => { if (controlledStep !== undefined) setInternalStep(controlledStep); }, [controlledStep]);

  const [selectedCell, setSelectedCell] = useState<{ step: number; variable: string } | null>(null);
  const playbackRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (widgetState === 'playing') {
      const ms = Math.max(100, (1 / playbackSpeed) * 1000);
      playbackRef.current = setInterval(() => {
        setInternalStep((prev) => {
          const next = prev + 1;
          if (next >= steps.length) { send({ type: 'STEP_END' }); return prev; }
          onStepChange?.(next);
          return next;
        });
      }, ms);
    }
    return () => { if (playbackRef.current) { clearInterval(playbackRef.current); playbackRef.current = null; } };
  }, [widgetState, playbackSpeed, steps.length, onStepChange]);

  const didValueChange = (stepIdx: number, variable: string): boolean => {
    if (stepIdx === 0) return false;
    return steps[stepIdx - 1]?.state[variable] !== steps[stepIdx]?.state[variable];
  };

  const currentStepData = steps[activeStep];

  return (
    <View ref={ref} testID="trace-timeline-viewer" accessibilityRole="grid" accessibilityLabel="Trace timeline" style={st.root}>
      {/* Time axis */}
      <ScrollView horizontal style={st.timeAxis}>
        <View style={st.timeAxisRow}>
          <View style={st.cornerCell} />
          {steps.map((step) => (
            <Text key={step.index} style={[st.timeLabel, step.isError && { color: 'red' }]}
              accessibilityLabel={`Step ${step.index}${step.isError ? ' (error)' : ''}`}>{step.index}</Text>
          ))}
        </View>
      </ScrollView>

      {/* Lanes */}
      <ScrollView style={st.lanes}>
        {variables.map((variable) => (
          <View key={variable} style={st.lane}>
            <Text style={st.laneLabel}>{variable}</Text>
            <ScrollView horizontal>
              <View style={st.laneRow}>
                {steps.map((step) => {
                  const value = step.state[variable] ?? '';
                  const changed = didValueChange(step.index, variable);
                  if (showChangesOnly && !changed && step.index !== 0) return null;
                  const isCurrent = step.index === activeStep;
                  const isSelected = selectedCell?.step === step.index && selectedCell?.variable === variable;
                  return (
                    <Pressable key={step.index} onPress={() => { setSelectedCell({ step: step.index, variable }); goToStep(step.index); send({ type: 'SELECT_CELL' }); }}
                      accessibilityRole="button" accessibilityLabel={`${variable} at step ${step.index}: ${value}`}
                      style={[st.cell, isCurrent && st.cellCurrent, isSelected && st.cellSelected, step.isError && st.cellError]}>
                      <Text style={[st.cellText, changed && { fontWeight: '700' }]}>{value}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        ))}
      </ScrollView>

      {/* Playback controls */}
      <View style={st.controls} accessibilityRole="toolbar" accessibilityLabel="Playback controls">
        <Pressable onPress={() => { send({ type: 'STEP_BACKWARD' }); goToStep(activeStep - 1); }} disabled={activeStep <= 0}
          accessibilityRole="button" accessibilityLabel="Step backward" style={st.ctrlBtn}>
          <Text style={activeStep <= 0 ? st.ctrlDisabled : undefined}>{'\u00AB'}</Text>
        </Pressable>
        <Pressable onPress={() => { if (widgetState === 'playing') send({ type: 'PAUSE' }); else send({ type: 'PLAY' }); }}
          accessibilityRole="button" accessibilityLabel={widgetState === 'playing' ? 'Pause' : 'Play'} style={st.ctrlBtn}>
          <Text>{widgetState === 'playing' ? '\u23F8' : '\u25B6'}</Text>
        </Pressable>
        <Pressable onPress={() => { send({ type: 'STEP_FORWARD' }); goToStep(activeStep + 1); }} disabled={activeStep >= steps.length - 1}
          accessibilityRole="button" accessibilityLabel="Step forward" style={st.ctrlBtn}>
          <Text style={activeStep >= steps.length - 1 ? st.ctrlDisabled : undefined}>{'\u00BB'}</Text>
        </Pressable>
        <Text style={st.stepCounter} accessibilityLiveRegion="polite">
          {steps.length > 0 ? `${activeStep + 1} / ${steps.length}` : '0 / 0'}
        </Text>
      </View>

      {/* Detail panel */}
      {widgetState === 'cellSelected' && currentStepData && (
        <View style={st.detailPanel} accessibilityLiveRegion="polite" accessibilityLabel={`State detail for step ${activeStep}`}>
          <Text style={st.detailTitle}>
            Step {currentStepData.index}: {currentStepData.label}
            {currentStepData.isError && <Text style={{ color: 'red' }}> (error)</Text>}
          </Text>
          {currentStepData.timestamp && <Text style={st.detailTimestamp}>{currentStepData.timestamp}</Text>}
          {Object.entries(currentStepData.state).map(([key, value]) => (
            <View key={key} style={st.detailEntry}>
              <Text style={st.detailKey}>{key}:</Text>
              <Text style={[st.detailValue, didValueChange(activeStep, key) && { fontWeight: '700' }]}>{value}</Text>
            </View>
          ))}
        </View>
      )}
      {children}
    </View>
  );
});

const st = StyleSheet.create({
  root: { flex: 1 },
  timeAxis: { borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  timeAxisRow: { flexDirection: 'row', alignItems: 'center' },
  cornerCell: { width: 80 },
  timeLabel: { width: 60, textAlign: 'center', fontSize: 12, paddingVertical: 4 },
  lanes: { flex: 1 },
  lane: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  laneLabel: { width: 80, fontSize: 12, fontWeight: '600', paddingHorizontal: 4 },
  laneRow: { flexDirection: 'row' },
  cell: { width: 60, paddingVertical: 4, paddingHorizontal: 2, alignItems: 'center', borderRightWidth: 1, borderRightColor: '#f3f4f6' },
  cellCurrent: { backgroundColor: '#dbeafe' },
  cellSelected: { borderWidth: 2, borderColor: '#6366f1' },
  cellError: { backgroundColor: '#fee2e2' },
  cellText: { fontSize: 11 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  ctrlBtn: { padding: 8 },
  ctrlDisabled: { opacity: 0.3 },
  stepCounter: { fontSize: 13, marginLeft: 'auto' },
  detailPanel: { padding: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  detailTitle: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  detailTimestamp: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  detailEntry: { flexDirection: 'row', gap: 4, marginVertical: 1 },
  detailKey: { fontSize: 12, fontWeight: '600' },
  detailValue: { fontSize: 12 },
});

TraceTimelineViewer.displayName = 'TraceTimelineViewer';
export { TraceTimelineViewer };
export default TraceTimelineViewer;
