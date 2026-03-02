// ============================================================
// Clef Surface Ink Widget — WidgetMachine
//
// Terminal-rendered headless component using Ink. Displays the
// state machine status and maps anatomy parts to terminal
// layout regions. Connects Clef Surface WidgetSpec to terminal
// rendering through the machine runner.
// ============================================================

import React, { useState, useEffect, useCallback, type ReactNode } from 'react';
import { Box, Text, useInput } from 'ink';

import type {
  WidgetSpec,
  MachineState,
  ConnectedProps,
  Signal,
} from '../../shared/types.js';
import { createMachine } from '../../shared/surface-bridge.js';

// --------------- State Visual Mapping ---------------

const STATE_ICONS: Record<string, string> = {
  idle: '○', active: '●', loading: '◔', disabled: '◌',
  error: '✖', success: '✔', focused: '◉', pressed: '▣',
  hover: '◎', open: '▽', closed: '▷', checked: '☑', unchecked: '☐',
};

const STATE_COLORS: Record<string, string> = {
  idle: 'gray', active: 'green', loading: 'yellow', disabled: 'gray',
  error: 'red', success: 'green', focused: 'cyan', pressed: 'magenta',
  hover: 'cyan', open: 'green', closed: 'gray', checked: 'green', unchecked: 'gray',
};

// --------------- Props ---------------

export interface WidgetMachineProps {
  /** Clef Surface widget specification. */
  spec: WidgetSpec;
  /** Initial context for the state machine. */
  initialContext?: Record<string, unknown>;
  /** Content renderers for each anatomy part. */
  partRenderers?: Record<string, (props: Record<string, unknown>) => ReactNode>;
  /** Whether to show the status line. */
  showStatus?: boolean;
  /** Whether to show available transitions. */
  showTransitions?: boolean;
  /** Whether to show context values. */
  showContext?: boolean;
  /** Width in columns. */
  width?: number;
  /** Title override (defaults to spec.name). */
  title?: string;
  /** Accent color. */
  accentColor?: string;
  /** Whether this component is focused. */
  isFocused?: boolean;
}

// --------------- Component ---------------

export const WidgetMachine: React.FC<WidgetMachineProps> = ({
  spec,
  initialContext,
  partRenderers = {},
  showStatus = true,
  showTransitions = false,
  showContext = false,
  width = 50,
  title,
  accentColor = 'cyan',
  isFocused = true,
}) => {
  const [machine] = useState(() => createMachine(spec, initialContext));
  const [state, setState] = useState<MachineState>(machine.state.get());
  const [connected, setConnected] = useState<ConnectedProps>(machine.connect());

  useEffect(() => {
    return machine.state.subscribe((s) => {
      setState(s);
      setConnected(machine.connect());
    });
  }, [machine]);

  // Map keys to machine events
  useInput(
    (input, key) => {
      const keyMap: Record<string, string> = {
        return: 'SUBMIT',
        space: 'TOGGLE',
        escape: 'CANCEL',
      };

      let eventType: string | undefined;
      if (key.return) eventType = 'SUBMIT';
      else if (key.escape) eventType = 'CANCEL';
      else if (key.upArrow) eventType = 'PREV';
      else if (key.downArrow) eventType = 'NEXT';
      else if (input === ' ') eventType = 'TOGGLE';
      else if (key.tab) eventType = 'FOCUS_NEXT';
      else eventType = `KEY_${input.toUpperCase()}`;

      const stateDef = spec.machineSpec.states[state.current];
      if (stateDef?.on?.[eventType]) {
        machine.send({ type: eventType });
      }
    },
    { isActive: isFocused },
  );

  const widgetTitle = title || spec.name;
  const stateIcon = STATE_ICONS[state.current] || '□';
  const stateColor = STATE_COLORS[state.current] || undefined;
  const innerWidth = width - 4;

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      paddingX={1}
      width={width}
    >
      {/* Title bar */}
      <Box>
        <Text bold color={accentColor}>{widgetTitle}</Text>
        <Text> </Text>
        <Text color={stateColor}>{stateIcon} {state.current}</Text>
      </Box>

      <Text dimColor>{'─'.repeat(innerWidth)}</Text>

      {/* Status line: show all states with current highlighted */}
      {showStatus && (
        <Box>
          {Object.keys(spec.machineSpec.states).map((s, i, arr) => (
            <React.Fragment key={s}>
              {s === state.current ? (
                <Text bold color={STATE_COLORS[s]}>[{s}]</Text>
              ) : (
                <Text dimColor>{s}</Text>
              )}
              {i < arr.length - 1 && <Text dimColor> → </Text>}
            </React.Fragment>
          ))}
        </Box>
      )}

      {/* Available transitions */}
      {showTransitions && (() => {
        const stateDef = spec.machineSpec.states[state.current];
        if (!stateDef?.on) return null;
        return (
          <Box flexDirection="column">
            <Text dimColor>Transitions:</Text>
            {Object.entries(stateDef.on).map(([event, target]) => {
              const targetName = typeof target === 'string' ? target : target.target;
              const guard = typeof target === 'object' && target.guard
                ? ` guard:${target.guard}` : '';
              return (
                <Box key={event}>
                  <Text>  </Text>
                  <Text color="yellow">{event}</Text>
                  <Text> → </Text>
                  <Text color="cyan">{targetName}</Text>
                  {guard && <Text dimColor>{guard}</Text>}
                </Box>
              );
            })}
          </Box>
        );
      })()}

      {/* Context display */}
      {showContext && Object.keys(state.context).length > 0 && (
        <Box flexDirection="column">
          <Text dimColor>Context:</Text>
          {Object.entries(state.context).map(([key, value]) => (
            <Box key={key}>
              <Text>  </Text>
              <Text dimColor>{key}: </Text>
              <ContextValue value={value} />
            </Box>
          ))}
        </Box>
      )}

      {/* Anatomy parts */}
      {spec.anatomy.parts.length > 0 && (
        <>
          <Text dimColor>├{'─'.repeat(innerWidth - 2)}┤</Text>
          {spec.anatomy.parts.map((partName) => {
            const partProps = connected[partName] || {};
            const renderer = partRenderers[partName];
            const dataState = partProps['data-state'] as string || '';

            if (renderer) {
              return (
                <Box key={partName} flexDirection="column">
                  {renderer(partProps)}
                </Box>
              );
            }

            return (
              <Box key={partName}>
                <Text color={accentColor}>▸ </Text>
                <Text bold>{partName}</Text>
                {dataState && (
                  <Text color={STATE_COLORS[dataState]}> [{dataState}]</Text>
                )}
              </Box>
            );
          })}
        </>
      )}

      {/* Slots */}
      {spec.anatomy.slots && spec.anatomy.slots.length > 0 && (
        <Text dimColor>Slots: {spec.anatomy.slots.join(', ')}</Text>
      )}
    </Box>
  );
};

// --------------- Context Value Display ---------------

const ContextValue: React.FC<{ value: unknown }> = ({ value }) => {
  if (value === null || value === undefined) return <Text dimColor>null</Text>;
  if (typeof value === 'boolean') {
    return <Text color={value ? 'green' : 'red'}>{String(value)}</Text>;
  }
  if (typeof value === 'number') return <Text color="cyan">{value}</Text>;
  if (typeof value === 'string') return <Text color="yellow">"{value}"</Text>;
  return <Text dimColor>{JSON.stringify(value)}</Text>;
};

WidgetMachine.displayName = 'WidgetMachine';
export default WidgetMachine;
