export type VariableInspectorState = 'idle' | 'filtering' | 'varSelected';
export type VariableInspectorEvent =
  | { type: 'SEARCH'; query?: string }
  | { type: 'SELECT_VAR'; name?: string }
  | { type: 'ADD_WATCH'; name?: string }
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
      if (event.type === 'SELECT_VAR') return 'varSelected';
      return state;
    case 'varSelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'SELECT_VAR') return 'varSelected';
      return state;
    default:
      return state;
  }
}

import React, { forwardRef, useCallback, useMemo, useReducer, useState, type ReactNode } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, StyleSheet } from 'react-native';

export interface ProcessVariable {
  name: string;
  type: string;
  value: unknown;
  scope?: string;
  changed?: boolean;
}

export interface WatchExpression {
  id: string;
  expression: string;
  value?: unknown;
}

export interface VariableInspectorProps {
  variables: ProcessVariable[];
  runStatus: string;
  showTypes?: boolean;
  showWatch?: boolean;
  expandDepth?: number;
  watchExpressions?: WatchExpression[];
  onSelectVariable?: (name: string) => void;
  onAddWatch?: (expression: string) => void;
  onRemoveWatch?: (id: string) => void;
  onEditValue?: (name: string, value: unknown) => void;
  children?: ReactNode;
}

function formatValue(value: unknown, depth: number, maxDepth: number): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (depth >= maxDepth) {
    if (Array.isArray(value)) return `Array(${value.length})`;
    return '{...}';
  }
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

function typeBadgeLabel(type: string): string {
  const map: Record<string, string> = { string: 'str', number: 'num', boolean: 'bool', object: 'obj', array: 'arr' };
  return map[type.toLowerCase()] ?? type;
}

function ValueDisplay({ value, depth, maxDepth }: { value: unknown; depth: number; maxDepth: number }) {
  const [expanded, setExpanded] = useState(depth < maxDepth);

  if (value === null || value === undefined || typeof value !== 'object') {
    return <Text style={vs.primitive}>{formatValue(value, depth, maxDepth)}</Text>;
  }

  const entries = Array.isArray(value)
    ? value.map((v, i) => [String(i), v] as const)
    : Object.entries(value as Record<string, unknown>);

  return (
    <View>
      <Pressable onPress={() => setExpanded(!expanded)} accessibilityRole="button" accessibilityLabel={expanded ? 'Collapse value' : 'Expand value'}>
        <Text style={vs.expandToggle}>
          {expanded ? '\u25BC' : '\u25B6'} {Array.isArray(value) ? `Array(${value.length})` : `Object(${entries.length})`}
        </Text>
      </Pressable>
      {expanded && entries.map(([key, val]) => (
        <View key={key} style={{ paddingLeft: (depth + 1) * 12 }}>
          <View style={vs.entryRow}>
            <Text style={vs.entryKey}>{key}: </Text>
            <ValueDisplay value={val} depth={depth + 1} maxDepth={maxDepth} />
          </View>
        </View>
      ))}
    </View>
  );
}

const vs = StyleSheet.create({
  primitive: { fontSize: 12, color: '#1e40af' },
  expandToggle: { fontSize: 12, color: '#6366f1', fontWeight: '600' },
  entryRow: { flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 1 },
  entryKey: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
});

const VariableInspector = forwardRef<View, VariableInspectorProps>(function VariableInspector(
  {
    variables,
    runStatus,
    showTypes = true,
    showWatch = true,
    expandDepth = 1,
    watchExpressions = [],
    onSelectVariable,
    onAddWatch,
    onRemoveWatch,
    onEditValue,
    children,
  },
  ref,
) {
  const [state, send] = useReducer(variableInspectorReducer, 'idle');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVar, setSelectedVar] = useState<string | null>(null);

  const filteredVariables = useMemo(() => {
    if (!searchQuery) return variables;
    const q = searchQuery.toLowerCase();
    return variables.filter((v) => v.name.toLowerCase().includes(q));
  }, [variables, searchQuery]);

  const handleSearch = useCallback((value: string) => {
    setSearchQuery(value);
    if (value) send({ type: 'SEARCH', query: value });
    else send({ type: 'CLEAR' });
  }, []);

  const handleSelectVar = useCallback((name: string) => {
    setSelectedVar(name);
    send({ type: 'SELECT_VAR', name });
    onSelectVariable?.(name);
  }, [onSelectVariable]);

  return (
    <View ref={ref} testID="variable-inspector" accessibilityRole="none" accessibilityLabel="Variable inspector" style={s.root}>
      {/* Search */}
      <View style={s.searchRow}>
        <TextInput
          style={s.searchInput}
          placeholder="Filter variables..."
          value={searchQuery}
          onChangeText={handleSearch}
          accessibilityLabel="Filter variables by name"
        />
        {searchQuery !== '' && (
          <Pressable onPress={() => handleSearch('')} accessibilityRole="button" accessibilityLabel="Clear search" style={s.clearButton}>
            <Text style={s.clearButtonText}>{'\u2715'}</Text>
          </Pressable>
        )}
      </View>

      {/* Variable list */}
      <ScrollView style={s.varList} accessibilityRole="list" accessibilityLabel="Variables">
        {filteredVariables.map((variable) => {
          const isSelected = selectedVar === variable.name;
          return (
            <Pressable
              key={variable.name}
              onPress={() => handleSelectVar(variable.name)}
              accessibilityRole="none"
              accessibilityLabel={`${variable.name}: ${formatValue(variable.value, 0, 0)}`}
              accessibilityState={{ selected: isSelected }}
              style={[s.varItem, isSelected && s.varItemSelected]}
            >
              <View style={s.varHeader}>
                <Text style={s.varName}>{variable.name}</Text>
                {showTypes && (
                  <View style={s.typeBadge}>
                    <Text style={s.typeBadgeText}>{typeBadgeLabel(variable.type)}</Text>
                  </View>
                )}
                {variable.scope && (
                  <Text style={s.scopeLabel} accessibilityLabel={`Scope: ${variable.scope}`}>{variable.scope}</Text>
                )}
                {variable.changed && (
                  <Text style={s.changedDot} accessibilityLabel="Value changed">{'\u2022'}</Text>
                )}
              </View>
              <View style={s.varValueContainer}>
                <ValueDisplay value={variable.value} depth={0} maxDepth={expandDepth} />
              </View>
            </Pressable>
          );
        })}
        {filteredVariables.length === 0 && (
          <View style={s.emptyState}>
            <Text style={s.emptyText}>{searchQuery ? 'No variables match the filter' : 'No variables available'}</Text>
          </View>
        )}
      </ScrollView>

      {/* Watch list */}
      {showWatch && (
        <View style={s.watchSection}>
          <View style={s.watchHeader}>
            <Text style={s.watchTitle}>Watch Expressions</Text>
            <Pressable
              onPress={() => {
                const expr = selectedVar ?? '';
                if (expr) {
                  send({ type: 'ADD_WATCH', name: expr });
                  onAddWatch?.(expr);
                }
              }}
              accessibilityRole="button"
              accessibilityLabel="Add watch expression"
              style={s.addWatchButton}
            >
              <Text style={s.addWatchText}>+ Watch</Text>
            </Pressable>
          </View>
          {watchExpressions.map((watch) => (
            <View key={watch.id} style={s.watchItem}>
              <Text style={s.watchExpression}>{watch.expression}</Text>
              <Text style={s.watchValue}>{watch.value !== undefined ? formatValue(watch.value, 0, 1) : 'evaluating...'}</Text>
              <Pressable
                onPress={() => onRemoveWatch?.(watch.id)}
                accessibilityRole="button"
                accessibilityLabel={`Remove watch: ${watch.expression}`}
              >
                <Text style={s.removeWatchText}>{'\u2715'}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {children}
    </View>
  );
});

const s = StyleSheet.create({
  root: { padding: 12, flex: 1 },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  searchInput: { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, padding: 8, fontSize: 14 },
  clearButton: { marginLeft: 6, padding: 6 },
  clearButtonText: { fontSize: 14, color: '#6b7280' },
  varList: { flex: 1 },
  varItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  varItemSelected: { backgroundColor: '#ede9fe', borderRadius: 6 },
  varHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  varName: { fontSize: 13, fontWeight: '700' },
  typeBadge: { backgroundColor: '#f3f4f6', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3 },
  typeBadgeText: { fontSize: 10, color: '#6b7280', fontWeight: '600' },
  scopeLabel: { fontSize: 10, color: '#9ca3af' },
  changedDot: { color: '#f59e0b', fontSize: 14 },
  varValueContainer: { paddingLeft: 4 },
  emptyState: { padding: 16, alignItems: 'center' },
  emptyText: { fontSize: 13, color: '#9ca3af' },
  watchSection: { borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 10, marginTop: 8 },
  watchHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  watchTitle: { fontSize: 13, fontWeight: '700' },
  addWatchButton: { paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#6366f1', borderRadius: 4 },
  addWatchText: { fontSize: 12, color: '#fff', fontWeight: '600' },
  watchItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  watchExpression: { flex: 1, fontSize: 12, fontWeight: '600' },
  watchValue: { fontSize: 12, color: '#6b7280' },
  removeWatchText: { fontSize: 12, color: '#dc2626' },
});

VariableInspector.displayName = 'VariableInspector';
export { VariableInspector };
export default VariableInspector;
