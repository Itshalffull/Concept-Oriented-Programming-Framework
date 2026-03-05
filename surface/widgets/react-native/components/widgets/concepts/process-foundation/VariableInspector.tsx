export type VariableInspectorState = 'idle' | 'filtering' | 'varSelected';
export type VariableInspectorEvent =
  | { type: 'SEARCH' }
  | { type: 'SELECT_VAR' }
  | { type: 'ADD_WATCH' }
  | { type: 'CLEAR' }
  | { type: 'DESELECT' };

export function variableInspectorReducer(state: VariableInspectorState, event: VariableInspectorEvent): VariableInspectorState {
  switch (state) {
    case 'idle':
      if (event.type === 'SEARCH') return 'filtering';
      if (event.type === 'SELECT_VAR') return 'varSelected';
      if (event.type === 'ADD_WATCH') return 'idle';
      return state;
    case 'filtering':
      if (event.type === 'CLEAR') return 'idle';
      return state;
    case 'varSelected':
      if (event.type === 'DESELECT') return 'idle';
      return state;
    default:
      return state;
  }
}

import React, { useReducer } from 'react';
import { View, Text, Pressable } from 'react-native';

export interface VariableInspectorProps {
  variables: unknown[];
  runStatus: string;
  showTypes?: boolean;
  showWatch?: boolean;
  expandDepth?: number;
}

export function VariableInspector(props: VariableInspectorProps) {
  const [state, send] = useReducer(variableInspectorReducer, 'idle');

  return (
    <View
      accessibilityRole="none"
      accessibilityLabel="Key-value inspector panel for process ru"
      data-widget="variable-inspector"
      data-state={state}
    >
      <View>{/* searchBar: Filter variables by name */}</View>
      <View>{/* variableList: Scrollable list of variables */}</View>
      <View>{/* variableItem: Single variable row */}</View>
      <Text>{/* Variable name */}</Text>
      <Text>{/* Variable type badge */}</Text>
    </View>
  );
}

export default VariableInspector;
