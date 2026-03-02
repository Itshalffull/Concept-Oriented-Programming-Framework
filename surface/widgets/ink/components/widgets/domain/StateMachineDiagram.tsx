// ============================================================
// Clef Surface Ink Widget — StateMachineDiagram
//
// Visual state-and-transition diagram rendered in the terminal
// as ASCII art. States display in parentheses with transitions
// shown as labeled arrows between them. The current state is
// highlighted.
//
// Adapts the state-machine-diagram.widget spec: anatomy (root,
// stateList, stateItem, stateName, stateFlags, transitionList,
// transitionItem, transitionFrom, transitionArrow, transitionTo,
// transitionLabel, addStateButton, addTransitionButton), states,
// and connect attributes.
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface MachineState {
  name: string;
  initial?: boolean;
  final?: boolean;
}

export interface MachineTransition {
  from: string;
  to: string;
  event: string;
}

// --------------- Props ---------------

export interface StateMachineDiagramProps {
  /** List of states in the machine. */
  states: MachineState[];
  /** List of transitions between states. */
  transitions: MachineTransition[];
  /** Name of the currently active state. */
  currentState?: string;
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
}

// --------------- Component ---------------

export const StateMachineDiagram: React.FC<StateMachineDiagramProps> = ({
  states,
  transitions,
  currentState,
  isFocused = false,
}) => {
  const [focusedIndex, setFocusedIndex] = useState(0);

  useInput(
    (input, key) => {
      if (!isFocused) return;

      if (key.downArrow || key.rightArrow) {
        setFocusedIndex((i) => Math.min(i + 1, states.length - 1));
      } else if (key.upArrow || key.leftArrow) {
        setFocusedIndex((i) => Math.max(i - 1, 0));
      }
    },
    { isActive: isFocused },
  );

  // Build transition map for display
  const transitionMap = new Map<string, { to: string; event: string }[]>();
  for (const t of transitions) {
    const list = transitionMap.get(t.from) || [];
    list.push({ to: t.to, event: t.event });
    transitionMap.set(t.from, list);
  }

  return (
    <Box flexDirection="column">
      {/* ASCII diagram */}
      <Box flexWrap="wrap" gap={0}>
        {states.map((state, index) => {
          const isCurrent = state.name === currentState;
          const isFocusedState = isFocused && focusedIndex === index;
          const outTransitions = transitionMap.get(state.name) || [];

          const statePrefix = state.initial ? '\u25B8' : state.final ? '\u25A0' : ' ';

          return (
            <Box key={state.name}>
              <Text
                inverse={isCurrent}
                bold={isCurrent || isFocusedState}
                color={isCurrent ? 'green' : isFocusedState ? 'cyan' : undefined}
              >
                {statePrefix}({state.name})
              </Text>
              {outTransitions.map((t, ti) => (
                <Text key={ti} dimColor>
                  {' \u2500'}<Text color="yellow">{t.event}</Text>{'\u2192 '}
                </Text>
              ))}
            </Box>
          );
        })}
      </Box>

      {/* Transition list */}
      <Box flexDirection="column" marginTop={1}>
        <Text bold dimColor>Transitions:</Text>
        {transitions.map((t, index) => {
          const fromIsCurrent = t.from === currentState;

          return (
            <Box key={index} paddingLeft={1}>
              <Text color={fromIsCurrent ? 'green' : undefined}>
                ({t.from})
              </Text>
              <Text dimColor> \u2500</Text>
              <Text color="yellow">{t.event}</Text>
              <Text dimColor>\u2192 </Text>
              <Text>({t.to})</Text>
            </Box>
          );
        })}
      </Box>

      {/* Legend */}
      <Box marginTop={1}>
        <Text dimColor>
          {'\u25B8'} initial {'  '} {'\u25A0'} final {'  '}
          <Text inverse> highlighted </Text> = current state
        </Text>
      </Box>
    </Box>
  );
};

StateMachineDiagram.displayName = 'StateMachineDiagram';
export default StateMachineDiagram;
