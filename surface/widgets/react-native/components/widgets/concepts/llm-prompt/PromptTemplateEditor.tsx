export type PromptTemplateEditorState = 'editing' | 'messageSelected' | 'compiling';
export type PromptTemplateEditorEvent =
  | { type: 'ADD_MESSAGE' }
  | { type: 'REMOVE_MESSAGE'; index?: number }
  | { type: 'REORDER'; from?: number; to?: number }
  | { type: 'COMPILE' }
  | { type: 'SELECT_MESSAGE'; index?: number }
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

import React, { forwardRef, useReducer, useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, StyleSheet } from 'react-native';

export type MessageRole = 'system' | 'user' | 'assistant';
export interface TemplateMessage { role: MessageRole; content: string; }
export interface TemplateVariable { name: string; type: string; defaultValue?: string; description?: string; }

export interface PromptTemplateEditorProps {
  messages?: TemplateMessage[];
  variables?: TemplateVariable[];
  modelId?: string | undefined;
  showParameters?: boolean;
  showTokenCount?: boolean;
  maxMessages?: number;
  onMessagesChange?: (messages: TemplateMessage[]) => void;
  onCompile?: (messages: TemplateMessage[], resolvedVariables: Record<string, string>) => void;
  children?: ReactNode;
}

const VARIABLE_REGEX = /\{\{(\w+)\}\}/g;

function extractVariables(content: string): string[] {
  const found = new Set<string>();
  let match: RegExpExecArray | null;
  const re = new RegExp(VARIABLE_REGEX.source, 'g');
  while ((match = re.exec(content)) !== null) found.add(match[1]);
  return Array.from(found);
}

function extractAllVariables(messages: TemplateMessage[]): string[] {
  const found = new Set<string>();
  for (const msg of messages) for (const v of extractVariables(msg.content)) found.add(v);
  return Array.from(found);
}

function estimateTokens(text: string): number { return Math.ceil(text.length / 4); }

function resolveTemplate(content: string, values: Record<string, string>): string {
  return content.replace(VARIABLE_REGEX, (full, name) => values[name] !== undefined ? values[name] : full);
}

const ROLES: MessageRole[] = ['system', 'user', 'assistant'];

const PromptTemplateEditor = forwardRef<View, PromptTemplateEditorProps>(function PromptTemplateEditor(
  { messages: initialMessages, variables: declaredVariables = [], modelId, showParameters = true, showTokenCount = true, maxMessages = 20, onMessagesChange, onCompile, children },
  ref,
) {
  const [state, send] = useReducer(promptTemplateEditorReducer, 'editing');
  const [messages, setMessages] = useState<TemplateMessage[]>(() => initialMessages ?? [{ role: 'system', content: '' }]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});

  useEffect(() => { if (initialMessages) setMessages(initialMessages); }, [initialMessages]);

  const detectedVarNames = useMemo(() => extractAllVariables(messages), [messages]);
  const allVariableNames = useMemo(() => {
    const set = new Set([...detectedVarNames, ...declaredVariables.map((v) => v.name)]);
    return Array.from(set);
  }, [detectedVarNames, declaredVariables]);

  const varLookup = useMemo(() => {
    const map = new Map<string, TemplateVariable>();
    for (const v of declaredVariables) map.set(v.name, v);
    return map;
  }, [declaredVariables]);

  const resolvedValues = useMemo(() => {
    const result: Record<string, string> = {};
    for (const name of allVariableNames) result[name] = variableValues[name] ?? varLookup.get(name)?.defaultValue ?? '';
    return result;
  }, [allVariableNames, variableValues, varLookup]);

  const totalContent = useMemo(() => messages.map((m) => m.content).join('\n'), [messages]);
  const charCount = totalContent.length;
  const tokenCount = estimateTokens(totalContent);

  const updateMessages = useCallback((next: TemplateMessage[]) => { setMessages(next); onMessagesChange?.(next); }, [onMessagesChange]);

  const handleAddMessage = useCallback(() => {
    if (messages.length >= maxMessages) return;
    updateMessages([...messages, { role: 'user', content: '' }]);
    send({ type: 'ADD_MESSAGE' });
  }, [messages, maxMessages, updateMessages]);

  const handleRemoveMessage = useCallback((index: number) => {
    if (messages.length <= 1) return;
    updateMessages(messages.filter((_, i) => i !== index));
    if (selectedIndex === index) { setSelectedIndex(null); send({ type: 'DESELECT' }); }
    else send({ type: 'REMOVE_MESSAGE', index });
  }, [messages, selectedIndex, updateMessages]);

  const handleRoleChange = useCallback((index: number) => {
    const current = messages[index].role;
    const nextRole = ROLES[(ROLES.indexOf(current) + 1) % ROLES.length];
    updateMessages(messages.map((m, i) => i === index ? { ...m, role: nextRole } : m));
  }, [messages, updateMessages]);

  const handleContentChange = useCallback((index: number, content: string) => {
    updateMessages(messages.map((m, i) => i === index ? { ...m, content } : m));
  }, [messages, updateMessages]);

  const handleCompile = useCallback(() => {
    send({ type: 'COMPILE' });
    try { onCompile?.(messages, resolvedValues); send({ type: 'COMPILE_COMPLETE' }); }
    catch { send({ type: 'COMPILE_ERROR' }); }
  }, [messages, resolvedValues, onCompile]);

  return (
    <View ref={ref} testID="prompt-template-editor" accessibilityRole="none" accessibilityLabel="Prompt template editor" style={s.root}>
      <View style={s.toolbar}>
        <Pressable onPress={() => setPreviewMode((p) => !p)} accessibilityRole="button" style={s.toolbarBtn}>
          <Text style={s.toolbarBtnText}>{previewMode ? 'Edit' : 'Preview'}</Text>
        </Pressable>
        <Pressable onPress={handleCompile} accessibilityRole="button" disabled={state === 'compiling'} style={s.toolbarBtn}>
          <Text style={s.toolbarBtnText}>{state === 'compiling' ? 'Compiling...' : 'Compile'}</Text>
        </Pressable>
      </View>
      <ScrollView style={s.messageList}>
        {messages.map((msg, index) => (
          <View key={index} style={[s.messageBlock, selectedIndex === index && s.messageBlockSel]}>
            <View style={s.messageHeader}>
              <Pressable onPress={() => handleRoleChange(index)} accessibilityRole="button" style={s.roleBadge}>
                <Text style={s.roleText}>{msg.role}</Text>
              </Pressable>
              <Pressable onPress={() => { setSelectedIndex(index); send({ type: 'SELECT_MESSAGE', index }); }} accessibilityRole="button">
                <Text style={s.selectText}>Select</Text>
              </Pressable>
              {messages.length > 1 && (
                <Pressable onPress={() => handleRemoveMessage(index)} accessibilityRole="button">
                  <Text style={s.deleteText}>Delete</Text>
                </Pressable>
              )}
            </View>
            {previewMode ? (
              <Text style={s.previewText}>{resolveTemplate(msg.content, resolvedValues)}</Text>
            ) : (
              <TextInput value={msg.content} onChangeText={(t) => handleContentChange(index, t)} multiline
                placeholder={`Enter ${msg.role} prompt template... Use {{variable}} for placeholders`}
                style={s.templateInput} accessibilityLabel={`Template content for ${msg.role} message ${index + 1}`} />
            )}
            {!previewMode && extractVariables(msg.content).length > 0 && (
              <View style={s.varPills}>
                {extractVariables(msg.content).map((varName) => {
                  const declared = varLookup.get(varName);
                  return (
                    <View key={varName} style={s.varPill}>
                      <Text style={s.varPillText}>{varName}{declared ? `: ${declared.type}` : ''}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ))}
      </ScrollView>
      <Pressable onPress={handleAddMessage} accessibilityRole="button" disabled={messages.length >= maxMessages} style={s.addBtn}>
        <Text style={s.addBtnText}>+ Add Message</Text>
      </Pressable>
      {allVariableNames.length > 0 && (
        <View style={s.varPanel}>
          <Text style={s.varPanelTitle}>Variables</Text>
          {allVariableNames.map((varName) => {
            const declared = varLookup.get(varName);
            return (
              <View key={varName} style={s.varRow}>
                <Text style={s.varLabel}>{`{{${varName}}}`}{declared ? ` (${declared.type})` : ''}</Text>
                <TextInput value={variableValues[varName] ?? ''} onChangeText={(t) => setVariableValues((prev) => ({ ...prev, [varName]: t }))}
                  placeholder={declared?.defaultValue ?? ''} style={s.varInput} accessibilityLabel={`Value for variable ${varName}`} />
              </View>
            );
          })}
        </View>
      )}
      {showParameters && modelId && (
        <View style={s.paramPanel}><Text style={s.paramLabel}>Model: {modelId}</Text></View>
      )}
      {showTokenCount && <Text style={s.tokenCount}>{charCount} chars | ~{tokenCount} tokens</Text>}
      {children}
    </View>
  );
});

const s = StyleSheet.create({
  root: { flex: 1 },
  toolbar: { flexDirection: 'row', gap: 8, padding: 8, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  toolbarBtn: { paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 4 },
  toolbarBtnText: { fontSize: 13, fontWeight: '600' },
  messageList: { flex: 1 },
  messageBlock: { margin: 8, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 6, padding: 8 },
  messageBlockSel: { borderColor: '#3b82f6', borderWidth: 2 },
  messageHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 2, backgroundColor: '#e0e7ff', borderRadius: 4 },
  roleText: { fontSize: 12, fontWeight: '600', color: '#4338ca', textTransform: 'capitalize' },
  selectText: { fontSize: 12, color: '#6366f1' },
  deleteText: { fontSize: 12, color: '#ef4444' },
  previewText: { fontSize: 13, fontFamily: 'monospace', padding: 8, backgroundColor: '#f9fafb', borderRadius: 4, minHeight: 60 },
  templateInput: { fontSize: 13, fontFamily: 'monospace', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 4, padding: 8, minHeight: 80, textAlignVertical: 'top' },
  varPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  varPill: { paddingHorizontal: 8, paddingVertical: 2, backgroundColor: '#dbeafe', borderRadius: 12 },
  varPillText: { fontSize: 12, color: '#1e40af' },
  addBtn: { margin: 8, padding: 10, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, alignItems: 'center' },
  addBtnText: { fontSize: 13, fontWeight: '600' },
  varPanel: { margin: 8, padding: 12, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 6 },
  varPanelTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  varRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  varLabel: { fontSize: 13, fontFamily: 'monospace', minWidth: 100 },
  varInput: { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 4, padding: 4, fontSize: 13, fontFamily: 'monospace' },
  paramPanel: { margin: 8, padding: 12, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 6 },
  paramLabel: { fontSize: 13 },
  tokenCount: { fontSize: 12, color: '#6b7280', margin: 8 },
});

PromptTemplateEditor.displayName = 'PromptTemplateEditor';
export { PromptTemplateEditor };
export default PromptTemplateEditor;
