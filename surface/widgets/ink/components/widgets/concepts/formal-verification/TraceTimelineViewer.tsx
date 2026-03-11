/* ---------------------------------------------------------------------------
 * TraceTimelineViewer — Ink (terminal) implementation
 * Horizontal timeline visualization of verification trace steps
 * See widget spec: trace-timeline-viewer.widget
 * ------------------------------------------------------------------------- */

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

import React, { useReducer, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export interface TraceStep {
  index: number;
  label: string;
  state: Record<string, string>;
  isError?: boolean;
  timestamp?: string;
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface TraceTimelineViewerProps {
  steps: TraceStep[];
  variables?: string[];
  currentStep?: number;
  playbackSpeed?: number;
  showChangesOnly?: boolean;
  zoom?: number;
  onStepChange?: (stepIndex: number) => void;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export function TraceTimelineViewer({
  steps,
  variables: variablesProp,
  currentStep: controlledStep,
  playbackSpeed = 1.0,
  showChangesOnly = false,
  zoom = 1.0,
  onStepChange,
}: TraceTimelineViewerProps) {
  const [widgetState, send] = useReducer(traceTimelineViewerReducer, 'idle');

  // Derive variable names
  const variables: string[] = variablesProp ?? (() => {
    const keys = new Set<string>();
    for (const step of steps) {
      for (const k of Object.keys(step.state)) keys.add(k);
    }
    return Array.from(keys);
  })();

  const [internalStep, setInternalStep] = useState(0);
  const activeStep = controlledStep ?? internalStep;

  const goToStep = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(idx, steps.length - 1));
      setInternalStep(clamped);
      onStepChange?.(clamped);
    },
    [steps.length, onStepChange],
  );

  useEffect(() => {
    if (controlledStep !== undefined) setInternalStep(controlledStep);
  }, [controlledStep]);

  const [selectedCell, setSelectedCell] = useState<{ step: number; variable: string } | null>(null);
  const [focusedLane, setFocusedLane] = useState(0);

  // Playback timer
  const playbackRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (widgetState === 'playing') {
      const intervalMs = Math.max(100, (1 / playbackSpeed) * 1000);
      playbackRef.current = setInterval(() => {
        setInternalStep((prev) => {
          const next = prev + 1;
          if (next >= steps.length) {
            send({ type: 'STEP_END' });
            return prev;
          }
          onStepChange?.(next);
          return next;
        });
      }, intervalMs);
    }
    return () => {
      if (playbackRef.current) {
        clearInterval(playbackRef.current);
        playbackRef.current = null;
      }
    };
  }, [widgetState, playbackSpeed, steps.length, onStepChange]);

  const didValueChange = (stepIdx: number, variable: string): boolean => {
    if (stepIdx === 0) return false;
    const prev = steps[stepIdx - 1]?.state[variable];
    const curr = steps[stepIdx]?.state[variable];
    return prev !== curr;
  };

  const currentStepData = steps[activeStep] as TraceStep | undefined;

  useInput((input, key) => {
    if (key.rightArrow) {
      send({ type: 'STEP_FORWARD' });
      goToStep(activeStep + 1);
    } else if (key.leftArrow) {
      send({ type: 'STEP_BACKWARD' });
      goToStep(activeStep - 1);
    } else if (input === ' ') {
      if (widgetState === 'playing') send({ type: 'PAUSE' });
      else send({ type: 'PLAY' });
    } else if (key.upArrow) {
      setFocusedLane((i) => Math.max(0, i - 1));
    } else if (key.downArrow) {
      setFocusedLane((i) => Math.min(variables.length - 1, i + 1));
    } else if (key.return) {
      if (variables[focusedLane] !== undefined) {
        setSelectedCell({ step: activeStep, variable: variables[focusedLane] });
        send({ type: 'SELECT_CELL' });
      }
    } else if (key.escape) {
      setSelectedCell(null);
      send({ type: 'DESELECT' });
    }
  });

  // Determine visible step window
  const VISIBLE_STEPS = 8;
  const stepWindowStart = Math.max(0, Math.min(activeStep - Math.floor(VISIBLE_STEPS / 2), steps.length - VISIBLE_STEPS));
  const stepWindowEnd = Math.min(stepWindowStart + VISIBLE_STEPS, steps.length);
  const visibleSteps = steps.slice(stepWindowStart, stepWindowEnd);

  return (
    <Box flexDirection="column" borderStyle="round">
      <Box>
        <Text bold>Trace Timeline</Text>
        <Text dimColor> Step {activeStep + 1}/{steps.length}</Text>
        <Text> </Text>
        <Text color={widgetState === 'playing' ? 'cyan' : 'white'}>
          {widgetState === 'playing' ? '\u23F8 Playing' : '\u25B6 Paused'}
        </Text>
      </Box>

      <Box><Text dimColor>{'\u2500'.repeat(55)}</Text></Box>

      {/* Time axis */}
      <Box>
        <Text dimColor>{''.padEnd(12)}</Text>
        {visibleSteps.map((step) => (
          <Box key={step.index} width={8}>
            <Text
              bold={step.index === activeStep}
              color={step.isError ? 'red' : step.index === activeStep ? 'cyan' : undefined}
            >
              {step.index === activeStep ? '\u25BC' : ' '}{step.index}
            </Text>
          </Box>
        ))}
      </Box>

      {/* Variable lanes */}
      {variables.map((variable, laneIdx) => {
        const isFocusedLane = laneIdx === focusedLane;

        return (
          <Box key={variable}>
            <Text bold={isFocusedLane} dimColor={!isFocusedLane}>
              {isFocusedLane ? '\u25B6 ' : '  '}
              {variable.padEnd(10).slice(0, 10)}
            </Text>
            {visibleSteps.map((step) => {
              const value = step.state[variable] ?? '';
              const changed = didValueChange(step.index, variable);
              const isCurrent = step.index === activeStep;
              const isSelected = selectedCell?.step === step.index && selectedCell?.variable === variable;

              if (showChangesOnly && !changed && step.index !== 0) {
                return (
                  <Box key={step.index} width={8}>
                    <Text dimColor>\u00B7</Text>
                  </Box>
                );
              }

              return (
                <Box key={step.index} width={8}>
                  <Text
                    bold={changed || isCurrent}
                    inverse={isSelected}
                    color={step.isError ? 'red' : changed ? 'yellow' : undefined}
                  >
                    {value.slice(0, 6)}
                  </Text>
                </Box>
              );
            })}
          </Box>
        );
      })}

      {/* Playback controls */}
      <Box><Text dimColor>{'\u2500'.repeat(55)}</Text></Box>
      <Box>
        <Text dimColor={activeStep <= 0}>\u00AB</Text>
        <Text> </Text>
        <Text bold color="cyan">
          {widgetState === 'playing' ? '\u23F8' : '\u25B6'}
        </Text>
        <Text> </Text>
        <Text dimColor={activeStep >= steps.length - 1}>\u00BB</Text>
      </Box>

      {/* Detail panel */}
      {widgetState === 'cellSelected' && currentStepData && (
        <>
          <Box><Text dimColor>{'\u2500'.repeat(55)}</Text></Box>
          <Box flexDirection="column">
            <Box>
              <Text bold>Step {currentStepData.index}: {currentStepData.label}</Text>
              {currentStepData.isError && <Text color="red"> (error)</Text>}
            </Box>
            {currentStepData.timestamp && (
              <Box><Text dimColor>{currentStepData.timestamp}</Text></Box>
            )}
            {Object.entries(currentStepData.state).map(([key, value]) => {
              const changed = didValueChange(activeStep, key);
              return (
                <Box key={key}>
                  <Text dimColor>  {key}: </Text>
                  <Text bold={changed} color={changed ? 'yellow' : undefined}>{value}</Text>
                </Box>
              );
            })}
          </Box>
        </>
      )}

      <Box><Text dimColor>{'\u2500'.repeat(55)}</Text></Box>
      <Box>
        <Text dimColor>Space play/pause  \u2190\u2192 step  \u2191\u2193 lane  Enter select  Esc clear</Text>
      </Box>
    </Box>
  );
}

export default TraceTimelineViewer;
