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

import React, { useReducer, useState } from 'react';
import { Box, Text, useInput } from 'ink';

interface GuardrailRule {
  id: string;
  name: string;
  type?: string;
  enabled: boolean;
  description?: string;
}

export interface GuardrailConfigProps {
  rules: GuardrailRule[];
  name: string;
  guardrailType: string;
  showHistory?: boolean;
  showTest?: boolean;
  onToggleRule?: (id: string) => void;
  onTest?: () => void;
  onAddRule?: () => void;
  isFocused?: boolean;
}

export function GuardrailConfig({
  rules,
  name,
  guardrailType,
  showTest = false,
  onToggleRule,
  onTest,
  onAddRule,
  isFocused = false,
}: GuardrailConfigProps) {
  const [state, send] = useReducer(guardrailConfigReducer, 'viewing');
  const [cursorIndex, setCursorIndex] = useState(0);

  useInput((input, key) => {
    if (!isFocused) return;

    if (state === 'adding') {
      if (key.escape) send({ type: 'CANCEL' });
      if (key.return) send({ type: 'SAVE' });
      return;
    }

    if (key.upArrow || input === 'k') {
      setCursorIndex(prev => Math.max(0, prev - 1));
    }
    if (key.downArrow || input === 'j') {
      setCursorIndex(prev => Math.min(rules.length - 1, prev + 1));
    }
    if (key.return) {
      if (state === 'ruleSelected') send({ type: 'DESELECT' });
      else send({ type: 'SELECT_RULE' });
    }
    if (key.escape) send({ type: 'DESELECT' });
    if (input === ' ') {
      const rule = rules[cursorIndex];
      if (rule) onToggleRule?.(rule.id);
    }
    if (input === 't' && showTest) {
      send({ type: 'TEST' });
      onTest?.();
      send({ type: 'TEST_COMPLETE' });
    }
    if (input === 'a') {
      send({ type: 'ADD_RULE' });
      onAddRule?.();
    }
  });

  const TYPE_COLORS: Record<string, string> = {
    input: 'cyan',
    output: 'green',
    content: 'yellow',
    safety: 'red',
  };

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={isFocused ? 'cyan' : undefined}>
      <Box justifyContent="space-between">
        <Box>
          <Text bold>{name}</Text>
          <Text color={TYPE_COLORS[guardrailType] ?? 'gray'}> [{guardrailType}]</Text>
        </Box>
        <Text color="gray">{rules.filter(r => r.enabled).length}/{rules.length} active</Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        {rules.map((rule, i) => {
          const isCursor = i === cursorIndex && isFocused;
          const isSelected = i === cursorIndex && state === 'ruleSelected';

          return (
            <Box key={rule.id} flexDirection="column">
              <Box>
                <Text color={isCursor ? 'cyan' : undefined}>
                  {isCursor ? '\u25B6 ' : '  '}
                </Text>
                <Text color={rule.enabled ? 'green' : 'red'}>
                  {rule.enabled ? '\u25CF' : '\u25CB'}{' '}
                </Text>
                <Text bold={isSelected}>{rule.name}</Text>
                {rule.type && <Text color="gray"> ({rule.type})</Text>}
              </Box>
              {isSelected && rule.description && (
                <Box paddingLeft={4}>
                  <Text color="gray" wrap="wrap">{rule.description}</Text>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {state === 'testing' && (
        <Box marginTop={1}>
          <Text color="yellow">Testing guardrails...</Text>
        </Box>
      )}

      {state === 'adding' && (
        <Box marginTop={1} borderStyle="single" borderColor="cyan">
          <Text>Adding new rule... [Enter] Save [Esc] Cancel</Text>
        </Box>
      )}

      {isFocused && state === 'viewing' && (
        <Box marginTop={1}>
          <Text color="gray">
            [{'\u2191\u2193'}] Nav [Space] Toggle [a]dd
            {showTest ? ' [t]est' : ''}
          </Text>
        </Box>
      )}
    </Box>
  );
}

export default GuardrailConfig;
