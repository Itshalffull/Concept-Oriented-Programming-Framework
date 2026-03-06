export type PromptEditorState = 'editing' | 'testing' | 'viewing';
export type PromptEditorEvent =
  | { type: 'TEST' }
  | { type: 'INPUT' }
  | { type: 'TEST_COMPLETE'; result?: string }
  | { type: 'TEST_ERROR'; error?: string }
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

import React, { forwardRef, useCallback, useMemo, useReducer, useState, type ReactNode } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, StyleSheet } from 'react-native';

export interface PromptMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface PromptTool {
  name: string;
  description?: string;
}

export interface PromptEditorProps {
  systemPrompt?: string | undefined;
  userPrompt: string;
  model: string;
  tools: PromptTool[];
  showTest?: boolean;
  showTools?: boolean;
  showTokenCount?: boolean;
  messages?: PromptMessage[];
  testResult?: string;
  testError?: string;
  onSystemPromptChange?: (value: string) => void;
  onUserPromptChange?: (value: string) => void;
  onMessagesChange?: (messages: PromptMessage[]) => void;
  onTest?: () => void;
  children?: ReactNode;
}

function extractVariables(text: string): string[] {
  const matches = text.match(/\{\{(\w+)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '')))];
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

const ROLE_LABELS: Record<string, string> = { system: 'System', user: 'User', assistant: 'Assistant' };
const ROLES: Array<'system' | 'user' | 'assistant'> = ['system', 'user', 'assistant'];

let nextMsgId = 1;
function generateMsgId(): string {
  return `msg-${nextMsgId++}`;
}

const PromptEditor = forwardRef<View, PromptEditorProps>(function PromptEditor(
  {
    systemPrompt,
    userPrompt,
    model,
    tools,
    showTest = true,
    showTools = true,
    showTokenCount = true,
    messages: messagesProp,
    testResult,
    testError,
    onSystemPromptChange,
    onUserPromptChange,
    onMessagesChange,
    onTest,
    children,
  },
  ref,
) {
  const [state, send] = useReducer(promptEditorReducer, 'editing');
  const [systemText, setSystemText] = useState(systemPrompt ?? '');
  const [userText, setUserText] = useState(userPrompt);
  const [messages, setMessages] = useState<PromptMessage[]>(messagesProp ?? []);
  const [lastTestResult, setLastTestResult] = useState(testResult);
  const [lastTestError, setLastTestError] = useState(testError);

  const allText = useMemo(() => {
    let total = systemText + userText;
    for (const msg of messages) total += msg.content;
    return total;
  }, [systemText, userText, messages]);

  const tokenCount = useMemo(() => estimateTokens(allText), [allText]);

  const detectedVariables = useMemo(() => extractVariables(allText), [allText]);

  const handleSystemChange = useCallback((value: string) => {
    setSystemText(value);
    send({ type: 'INPUT' });
    onSystemPromptChange?.(value);
  }, [onSystemPromptChange]);

  const handleUserChange = useCallback((value: string) => {
    setUserText(value);
    send({ type: 'INPUT' });
    onUserPromptChange?.(value);
  }, [onUserPromptChange]);

  const handleMessageContentChange = useCallback((id: string, content: string) => {
    setMessages((prev) => {
      const updated = prev.map((m) => (m.id === id ? { ...m, content } : m));
      onMessagesChange?.(updated);
      return updated;
    });
    send({ type: 'INPUT' });
  }, [onMessagesChange]);

  const handleMessageRoleChange = useCallback((id: string, role: PromptMessage['role']) => {
    setMessages((prev) => {
      const updated = prev.map((m) => (m.id === id ? { ...m, role } : m));
      onMessagesChange?.(updated);
      return updated;
    });
  }, [onMessagesChange]);

  const handleAddMessage = useCallback(() => {
    const newMsg: PromptMessage = { id: generateMsgId(), role: 'user', content: '' };
    setMessages((prev) => {
      const updated = [...prev, newMsg];
      onMessagesChange?.(updated);
      return updated;
    });
  }, [onMessagesChange]);

  const handleRemoveMessage = useCallback((id: string) => {
    setMessages((prev) => {
      const updated = prev.filter((m) => m.id !== id);
      onMessagesChange?.(updated);
      return updated;
    });
  }, [onMessagesChange]);

  const handleMoveMessage = useCallback((id: string, direction: -1 | 1) => {
    setMessages((prev) => {
      const index = prev.findIndex((m) => m.id === id);
      if (index < 0) return prev;
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      const updated = [...prev];
      [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
      onMessagesChange?.(updated);
      return updated;
    });
  }, [onMessagesChange]);

  const handleTest = useCallback(() => {
    send({ type: 'TEST' });
    onTest?.();
  }, [onTest]);

  useMemo(() => {
    if (testResult !== undefined && state === 'testing') {
      setLastTestResult(testResult);
      send({ type: 'TEST_COMPLETE', result: testResult });
    }
    if (testError !== undefined && state === 'testing') {
      setLastTestError(testError);
      send({ type: 'TEST_ERROR', error: testError });
    }
  }, [testResult, testError, state]);

  return (
    <ScrollView ref={ref} testID="prompt-editor" accessibilityRole="none" accessibilityLabel="Prompt editor" style={s.root}>
      {/* System prompt */}
      <View style={s.block}>
        <View style={[s.roleTag, { backgroundColor: '#6366f1' }]}>
          <Text style={s.roleTagText}>System</Text>
        </View>
        <TextInput
          style={s.textarea}
          placeholder="System instructions..."
          value={systemText}
          onChangeText={handleSystemChange}
          multiline
          numberOfLines={3}
          accessibilityLabel="System prompt"
        />
      </View>

      {/* User prompt */}
      <View style={s.block}>
        <View style={[s.roleTag, { backgroundColor: '#3b82f6' }]}>
          <Text style={s.roleTagText}>User</Text>
        </View>
        <TextInput
          style={s.textarea}
          placeholder="User prompt template..."
          value={userText}
          onChangeText={handleUserChange}
          multiline
          numberOfLines={5}
          accessibilityLabel="User prompt"
        />
      </View>

      {/* Additional messages */}
      {messages.map((msg, index) => (
        <View key={msg.id} style={s.block}>
          <View style={s.messageHeader}>
            <View style={s.roleSelectorRow}>
              {ROLES.map((r) => (
                <Pressable
                  key={r}
                  onPress={() => handleMessageRoleChange(msg.id, r)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: msg.role === r }}
                  accessibilityLabel={`Message ${index + 1} role: ${ROLE_LABELS[r]}`}
                  style={[s.roleSelectorChip, msg.role === r && s.roleSelectorChipActive]}
                >
                  <Text style={[s.roleSelectorText, msg.role === r && s.roleSelectorTextActive]}>{ROLE_LABELS[r]}</Text>
                </Pressable>
              ))}
            </View>
            <View style={s.messageActions}>
              <Pressable onPress={() => handleMoveMessage(msg.id, -1)} disabled={index === 0}
                accessibilityRole="button" accessibilityLabel="Move message up"
                style={[s.smallBtn, index === 0 && s.smallBtnDisabled]}>
                <Text style={s.smallBtnText}>{'\u2191'}</Text>
              </Pressable>
              <Pressable onPress={() => handleMoveMessage(msg.id, 1)} disabled={index === messages.length - 1}
                accessibilityRole="button" accessibilityLabel="Move message down"
                style={[s.smallBtn, index === messages.length - 1 && s.smallBtnDisabled]}>
                <Text style={s.smallBtnText}>{'\u2193'}</Text>
              </Pressable>
              <Pressable onPress={() => handleRemoveMessage(msg.id)}
                accessibilityRole="button" accessibilityLabel={`Remove message ${index + 1}`}
                style={s.smallBtn}>
                <Text style={[s.smallBtnText, { color: '#dc2626' }]}>{'\u2715'}</Text>
              </Pressable>
            </View>
          </View>
          <TextInput
            style={s.textarea}
            value={msg.content}
            onChangeText={(text) => handleMessageContentChange(msg.id, text)}
            multiline
            numberOfLines={3}
            accessibilityLabel={`${ROLE_LABELS[msg.role]} message content`}
          />
        </View>
      ))}

      {/* Add message */}
      <Pressable onPress={handleAddMessage} accessibilityRole="button" accessibilityLabel="Add message" style={s.addMessageBtn}>
        <Text style={s.addMessageText}>+ Add Message</Text>
      </Pressable>

      {/* Variable pills */}
      <View style={s.variablesSection} accessibilityLabel="Detected template variables">
        {detectedVariables.length > 0 ? (
          <View style={s.pillRow}>
            {detectedVariables.map((variable) => (
              <View key={variable} style={s.pill} accessibilityLabel={`Variable: ${variable}`}>
                <Text style={s.pillText}>{`{{${variable}}}`}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={s.noVarsText}>No template variables detected</Text>
        )}
      </View>

      {/* Model badge */}
      <View style={s.modelBadge}>
        <Text style={s.modelText}>{model}</Text>
      </View>

      {/* Token count */}
      {showTokenCount && (
        <Text style={s.tokenCount}>~{tokenCount} tokens</Text>
      )}

      {/* Test button */}
      {showTest && (
        <Pressable
          onPress={handleTest}
          disabled={state === 'testing'}
          accessibilityRole="button"
          accessibilityLabel="Test prompt"
          style={[s.testButton, state === 'testing' && s.testButtonDisabled]}
        >
          <Text style={s.testButtonText}>{state === 'testing' ? 'Testing...' : 'Test Prompt'}</Text>
        </Pressable>
      )}

      {/* Test result panel */}
      {state === 'viewing' && lastTestResult && (
        <View style={s.testPanel}>
          <View style={s.testPanelHeader}>
            <Text style={s.testPanelTitle}>Test Result</Text>
            <Pressable onPress={() => send({ type: 'EDIT' })} accessibilityRole="button" accessibilityLabel="Back to editing">
              <Text style={s.editBtnText}>Edit</Text>
            </Pressable>
          </View>
          <Text style={s.testOutput}>{lastTestResult}</Text>
        </View>
      )}
      {lastTestError && (
        <View style={s.testError} accessibilityRole="alert">
          <Text style={s.testErrorText}>{lastTestError}</Text>
        </View>
      )}

      {/* Tool list */}
      {showTools && tools.length > 0 && (
        <View style={s.toolsSection} accessibilityLabel="Available tools">
          <Text style={s.toolsHeader}>Tools ({tools.length})</Text>
          {tools.map((tool) => (
            <View key={tool.name} style={s.toolItem}>
              <Text style={s.toolName}>{tool.name}</Text>
              {tool.description && <Text style={s.toolDesc}>{tool.description}</Text>}
            </View>
          ))}
        </View>
      )}

      {children}
    </ScrollView>
  );
});

const s = StyleSheet.create({
  root: { padding: 12 },
  block: { marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, overflow: 'hidden' },
  roleTag: { paddingHorizontal: 10, paddingVertical: 4 },
  roleTagText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  textarea: { padding: 10, fontSize: 14, minHeight: 60, textAlignVertical: 'top' },
  messageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 6, backgroundColor: '#f9fafb' },
  roleSelectorRow: { flexDirection: 'row', gap: 4 },
  roleSelectorChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, borderWidth: 1, borderColor: '#d1d5db' },
  roleSelectorChipActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  roleSelectorText: { fontSize: 11, fontWeight: '600', color: '#374151' },
  roleSelectorTextActive: { color: '#fff' },
  messageActions: { flexDirection: 'row', gap: 4 },
  smallBtn: { padding: 4, borderRadius: 4, backgroundColor: '#f3f4f6' },
  smallBtnDisabled: { opacity: 0.3 },
  smallBtnText: { fontSize: 12, fontWeight: '600' },
  addMessageBtn: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#f3f4f6', borderRadius: 6, marginBottom: 12 },
  addMessageText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  variablesSection: { marginBottom: 8 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  pill: { backgroundColor: '#ede9fe', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  pillText: { fontSize: 12, color: '#6366f1', fontWeight: '600' },
  noVarsText: { fontSize: 12, color: '#9ca3af' },
  modelBadge: { alignSelf: 'flex-start', backgroundColor: '#f3f4f6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, marginBottom: 6 },
  modelText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  tokenCount: { fontSize: 12, color: '#6b7280', marginBottom: 8 },
  testButton: { backgroundColor: '#6366f1', paddingVertical: 10, borderRadius: 6, alignItems: 'center', marginBottom: 8 },
  testButtonDisabled: { opacity: 0.5 },
  testButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  testPanel: { backgroundColor: '#f9fafb', padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  testPanelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  testPanelTitle: { fontSize: 13, fontWeight: '700' },
  editBtnText: { fontSize: 13, color: '#6366f1', fontWeight: '600' },
  testOutput: { fontSize: 12, lineHeight: 18 },
  testError: { backgroundColor: '#fef2f2', padding: 10, borderRadius: 6, marginBottom: 8, borderWidth: 1, borderColor: '#fecaca' },
  testErrorText: { color: '#dc2626', fontSize: 13 },
  toolsSection: { borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 10, marginTop: 4 },
  toolsHeader: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  toolItem: { paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  toolName: { fontSize: 13, fontWeight: '600' },
  toolDesc: { fontSize: 12, color: '#6b7280' },
});

PromptEditor.displayName = 'PromptEditor';
export { PromptEditor };
export default PromptEditor;
