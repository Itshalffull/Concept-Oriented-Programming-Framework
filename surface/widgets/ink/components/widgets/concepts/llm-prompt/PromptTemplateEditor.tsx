export type PromptTemplateEditorState = 'editing' | 'messageSelected' | 'compiling';
export type PromptTemplateEditorEvent =
  | { type: 'ADD_MESSAGE' }
  | { type: 'REMOVE_MESSAGE' }
  | { type: 'REORDER' }
  | { type: 'COMPILE' }
  | { type: 'SELECT_MESSAGE' }
  | { type: 'DESELECT' }
  | { type: 'COMPILE_COMPLETE' }
  | { type: 'COMPILE_ERROR' };

export function promptTemplateEditorReducer(state: PromptTemplateEditorState, event: PromptTemplateEditorEvent): PromptTemplateEditorState {
  switch (state) {
    case 'editing':
      if (event.type === 'ADD_MESSAGE') return 'editing';
      if (event.type === 'REMOVE_MESSAGE') return 'editing';
      if (event.type === 'REORDER') return 'editing';
      if (event.type === 'COMPILE') return 'compiling';
      if (event.type === 'SELECT_MESSAGE') return 'messageSelected';
      return state;
    case 'messageSelected':
      if (event.type === 'DESELECT') return 'editing';
      if (event.type === 'SELECT_MESSAGE') return 'messageSelected';
      return state;
    case 'compiling':
      if (event.type === 'COMPILE_COMPLETE') return 'editing';
      if (event.type === 'COMPILE_ERROR') return 'editing';
      return state;
    default:
      return state;
  }
}

import React, { useReducer, useState } from 'react';
import { Box, Text, useInput } from 'ink';

interface PromptMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface TemplateVariable {
  name: string;
  value?: string;
}

const ROLE_COLORS: Record<string, string> = {
  system: 'yellow',
  user: 'cyan',
  assistant: 'green',
};

export interface PromptTemplateEditorProps {
  messages: PromptMessage[];
  variables: TemplateVariable[];
  modelId?: string | undefined;
  showParameters?: boolean;
  showTokenCount?: boolean;
  maxMessages?: number;
  tokenCount?: number;
  onAddMessage?: () => void;
  onRemoveMessage?: (id: string) => void;
  onCompile?: () => void;
  isFocused?: boolean;
}

export function PromptTemplateEditor({
  messages,
  variables,
  modelId,
  showParameters = false,
  showTokenCount = false,
  tokenCount,
  onAddMessage,
  onRemoveMessage,
  onCompile,
  isFocused = false,
}: PromptTemplateEditorProps) {
  const [state, send] = useReducer(promptTemplateEditorReducer, 'editing');
  const [cursorIndex, setCursorIndex] = useState(0);

  useInput((input, key) => {
    if (!isFocused) return;

    if (state === 'compiling') return;

    if (key.upArrow || input === 'k') {
      setCursorIndex(prev => Math.max(0, prev - 1));
    }
    if (key.downArrow || input === 'j') {
      setCursorIndex(prev => Math.min(messages.length - 1, prev + 1));
    }
    if (key.return) {
      if (state === 'messageSelected') send({ type: 'DESELECT' });
      else send({ type: 'SELECT_MESSAGE' });
    }
    if (key.escape) send({ type: 'DESELECT' });
    if (input === 'a') {
      send({ type: 'ADD_MESSAGE' });
      onAddMessage?.();
    }
    if (input === 'd' && state === 'messageSelected') {
      const msg = messages[cursorIndex];
      if (msg) {
        send({ type: 'REMOVE_MESSAGE' });
        onRemoveMessage?.(msg.id);
      }
    }
    if (input === 'c') {
      send({ type: 'COMPILE' });
      onCompile?.();
      send({ type: 'COMPILE_COMPLETE' });
    }
  });

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={isFocused ? 'cyan' : undefined}>
      <Box justifyContent="space-between">
        <Text bold>Prompt Template</Text>
        <Box>
          {modelId && <Text color="gray">[{modelId}]</Text>}
          {showTokenCount && tokenCount !== undefined && (
            <Text color="gray"> {tokenCount} tokens</Text>
          )}
        </Box>
      </Box>

      {/* Messages */}
      <Box flexDirection="column" marginTop={1}>
        {messages.map((msg, i) => {
          const isCursor = i === cursorIndex && isFocused;
          const isSelected = i === cursorIndex && state === 'messageSelected';
          const roleColor = ROLE_COLORS[msg.role] ?? 'white';

          return (
            <Box key={msg.id} flexDirection="column" borderStyle={isSelected ? 'single' : undefined} borderColor={isSelected ? 'cyan' : undefined}>
              <Box>
                <Text color={isCursor ? 'cyan' : undefined}>
                  {isCursor ? '\u25B6 ' : '  '}
                </Text>
                <Text color={roleColor} bold>[{msg.role}]</Text>
              </Box>
              <Box paddingLeft={4}>
                <Text wrap="wrap" color={isSelected ? 'white' : 'gray'}>{msg.content}</Text>
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Variables */}
      {variables.length > 0 && (
        <Box marginTop={1}>
          <Text color="gray">Variables: </Text>
          {variables.map((v, i) => (
            <Text key={v.name}>
              <Text color="magenta">{'{{'}}{v.name}{{'}}'}}</Text>
              {i < variables.length - 1 && <Text color="gray"> </Text>}
            </Text>
          ))}
        </Box>
      )}

      {state === 'compiling' && (
        <Box marginTop={1}>
          <Text color="yellow">Compiling template...</Text>
        </Box>
      )}

      {isFocused && (
        <Box marginTop={1}>
          <Text color="gray">
            [{'\u2191\u2193'}] Nav [Enter] Select [a]dd [c]ompile
            {state === 'messageSelected' ? ' [d]elete' : ''}
          </Text>
        </Box>
      )}
    </Box>
  );
}

export default PromptTemplateEditor;
