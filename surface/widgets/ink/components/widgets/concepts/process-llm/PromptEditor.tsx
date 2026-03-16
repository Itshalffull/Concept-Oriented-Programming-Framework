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

import React, { useReducer, useState } from 'react';
import { Box, Text, useInput } from 'ink';

export interface PromptEditorProps {
  systemPrompt?: string | undefined;
  userPrompt: string;
  model: string;
  tools: Array<{ name: string; description?: string }>;
  showTest?: boolean;
  showTools?: boolean;
  showTokenCount?: boolean;
  tokenCount?: number;
  testResult?: string;
  onTest?: () => void;
  onChange?: (field: string, value: string) => void;
  isFocused?: boolean;
}

export function PromptEditor({
  systemPrompt,
  userPrompt,
  model,
  tools,
  showTest = true,
  showTools = true,
  showTokenCount = false,
  tokenCount,
  testResult,
  onTest,
  isFocused = false,
}: PromptEditorProps) {
  const [state, send] = useReducer(promptEditorReducer, 'editing');
  const [activeBlock, setActiveBlock] = useState<'system' | 'user'>('user');

  useInput((input, key) => {
    if (!isFocused) return;

    if (key.tab) {
      setActiveBlock(prev => prev === 'system' ? 'user' : 'system');
    }

    if (input === 't' && showTest && state !== 'testing') {
      send({ type: 'TEST' });
      onTest?.();
    }

    if (input === 'e' && state === 'viewing') {
      send({ type: 'EDIT' });
    }
  });

  // Detect template variables like {{variable}}
  const extractVars = (text: string): string[] => {
    const matches = text.match(/\{\{(\w+)\}\}/g) ?? [];
    return [...new Set(matches.map(m => m.replace(/[{}]/g, '')))];
  };

  const allVars = [
    ...extractVars(systemPrompt ?? ''),
    ...extractVars(userPrompt),
  ];
  const uniqueVars = [...new Set(allVars)];

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={isFocused ? 'cyan' : undefined}>
      <Box justifyContent="space-between">
        <Text bold>Prompt Editor</Text>
        <Box>
          <Text color="gray">[{model}]</Text>
          {showTokenCount && tokenCount !== undefined && (
            <Text color="gray"> {tokenCount} tokens</Text>
          )}
        </Box>
      </Box>

      {/* System prompt */}
      {systemPrompt !== undefined && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="yellow" bold>
            {activeBlock === 'system' && isFocused ? '\u25B6 ' : '  '}
            [system]
          </Text>
          <Box paddingLeft={2}>
            <Text color={state === 'viewing' ? 'gray' : undefined} wrap="wrap">
              {systemPrompt || <Text color="gray">(empty)</Text>}
            </Text>
          </Box>
        </Box>
      )}

      {/* User prompt */}
      <Box flexDirection="column" marginTop={1}>
        <Text color="cyan" bold>
          {activeBlock === 'user' && isFocused ? '\u25B6 ' : '  '}
          [user]
        </Text>
        <Box paddingLeft={2}>
          <Text color={state === 'viewing' ? 'gray' : undefined} wrap="wrap">
            {userPrompt || <Text color="gray">(empty)</Text>}
          </Text>
        </Box>
      </Box>

      {/* Template variables */}
      {uniqueVars.length > 0 && (
        <Box marginTop={1}>
          <Text color="gray">Variables: </Text>
          {uniqueVars.map((v, i) => (
            <Text key={v}>
              <Text color="magenta">{`{{${v}}}`}</Text>
              {i < uniqueVars.length - 1 && <Text color="gray"> </Text>}
            </Text>
          ))}
        </Box>
      )}

      {/* Tools */}
      {showTools && tools.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="gray" bold>Tools ({tools.length}):</Text>
          {tools.map(tool => (
            <Box key={tool.name} paddingLeft={2}>
              <Text color="magenta">{'\u2692'} {tool.name}</Text>
              {tool.description && <Text color="gray"> - {tool.description}</Text>}
            </Box>
          ))}
        </Box>
      )}

      {/* Test result */}
      {state === 'testing' && (
        <Box marginTop={1}>
          <Text color="yellow">Testing prompt...</Text>
        </Box>
      )}

      {state === 'viewing' && testResult && (
        <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor="green">
          <Text color="green" bold>Test Result:</Text>
          <Box paddingLeft={2}>
            <Text wrap="wrap">{testResult}</Text>
          </Box>
        </Box>
      )}

      {isFocused && (
        <Box marginTop={1}>
          <Text color="gray">
            [Tab] Switch block
            {showTest ? ' [t]est' : ''}
            {state === 'viewing' ? ' [e]dit' : ''}
          </Text>
        </Box>
      )}
    </Box>
  );
}

export default PromptEditor;
