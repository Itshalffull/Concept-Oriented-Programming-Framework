export type GuardrailConfigState = 'viewing' | 'ruleSelected' | 'testing' | 'adding';
export type GuardrailConfigEvent =
  | { type: 'SELECT_RULE' }
  | { type: 'TEST' }
  | { type: 'ADD_RULE' }
  | { type: 'DESELECT' }
  | { type: 'TEST_COMPLETE' }
  | { type: 'SAVE' }
  | { type: 'CANCEL' };

export function guardrailConfigReducer(state: GuardrailConfigState, event: GuardrailConfigEvent): GuardrailConfigState {
  switch (state) {
    case 'viewing':
      if (event.type === 'SELECT_RULE') return 'ruleSelected';
      if (event.type === 'TEST') return 'testing';
      if (event.type === 'ADD_RULE') return 'adding';
      return state;
    case 'ruleSelected':
      if (event.type === 'DESELECT') return 'viewing';
      return state;
    case 'testing':
      if (event.type === 'TEST_COMPLETE') return 'viewing';
      return state;
    case 'adding':
      if (event.type === 'SAVE') return 'viewing';
      if (event.type === 'CANCEL') return 'viewing';
      return state;
    default:
      return state;
  }
}

import React, { useReducer } from 'react';
import { View, Text, Pressable } from 'react-native';

export interface GuardrailConfigProps {
  rules: unknown[];
  name: string;
  guardrailType: string;
  showHistory?: boolean;
  showTest?: boolean;
}

export function GuardrailConfig(props: GuardrailConfigProps) {
  const [state, send] = useReducer(guardrailConfigReducer, 'viewing');

  return (
    <View
      accessibilityRole="none"
      accessibilityLabel="Configuration panel for safety guardrail"
      data-widget="guardrail-config"
      data-state={state}
    >
      <View>{/* header: Guardrail name and type badge */}</View>
      <View>{/* ruleList: List of configured rules */}</View>
      <View>{/* ruleItem: Single rule entry */}</View>
      <View>{/* ruleToggle: Enable/disable toggle for the rule */}</View>
      <Text>{/* Rule name */}</Text>
    </View>
  );
}

export default GuardrailConfig;
