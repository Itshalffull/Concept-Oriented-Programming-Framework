export type PromptEditorState = 'editing' | 'testing' | 'viewing';
export type PromptEditorEvent =
  | { type: 'TEST' }
  | { type: 'INPUT' }
  | { type: 'TEST_COMPLETE' }
  | { type: 'TEST_ERROR' }
  | { type: 'EDIT' };

export function promptEditorReducer(state: PromptEditorState, event: PromptEditorEvent): PromptEditorState {
  switch (state) {
    case 'editing':
      if (event.type === 'TEST') return 'testing';
      if (event.type === 'INPUT') return 'editing';
      return state;
    case 'testing':
      if (event.type === 'TEST_COMPLETE') return 'viewing';
      if (event.type === 'TEST_ERROR') return 'editing';
      return state;
    case 'viewing':
      if (event.type === 'EDIT') return 'editing';
      if (event.type === 'TEST') return 'testing';
      return state;
    default:
      return state;
  }
}

import React, { useReducer } from 'react';
import { View, Text, Pressable } from 'react-native';

export interface PromptEditorProps {
  systemPrompt?: string | undefined;
  userPrompt: string;
  model: string;
  tools: unknown[];
  showTest?: boolean;
  showTools?: boolean;
  showTokenCount?: boolean;
}

export function PromptEditor(props: PromptEditorProps) {
  const [state, send] = useReducer(promptEditorReducer, 'editing');

  return (
    <View
      accessibilityRole="none"
      accessibilityLabel="Multi-message prompt template editor for"
      data-widget="prompt-editor"
      data-state={state}
    >
      <View>{/* systemBlock: System prompt message block */}</View>
      <View>{/* userBlock: User prompt message block with variable highlighting */}</View>
      <View>{/* variablePills: Auto-detected template variables */}</View>
      <View>{/* modelBadge: Model name badge */}</View>
      <Text>{/* Estimated token count */}</Text>
    </View>
  );
}

export default PromptEditor;
