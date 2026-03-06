export type GuardrailConfigState = 'viewing' | 'ruleSelected' | 'testing' | 'adding';
export type GuardrailConfigEvent =
  | { type: 'SELECT_RULE'; id?: string }
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

import React, { forwardRef, useReducer, useState, useCallback, type ReactNode } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, StyleSheet } from 'react-native';

export type RuleSeverity = 'block' | 'warn' | 'log';
export type RuleType = 'input' | 'output' | 'both';

export interface GuardrailRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  type: RuleType;
  severity: RuleSeverity;
}

export interface TestResult {
  ruleId: string;
  ruleName: string;
  triggered: boolean;
  severity: RuleSeverity;
}

export interface GuardrailConfigProps {
  rules: GuardrailRule[];
  name: string;
  guardrailType: string;
  testInput?: string;
  showHistory?: boolean;
  showTest?: boolean;
  onRuleToggle?: (id: string, enabled: boolean) => void;
  onSeverityChange?: (id: string, severity: RuleSeverity) => void;
  onTest?: (input: string) => void | TestResult[] | Promise<TestResult[]>;
  onAddRule?: () => void;
  children?: ReactNode;
}

const SEVERITY_OPTIONS: RuleSeverity[] = ['block', 'warn', 'log'];

const SEVERITY_COLORS: Record<RuleSeverity, string> = {
  block: '#dc2626',
  warn: '#ca8a04',
  log: '#2563eb',
};

const GuardrailConfig = forwardRef<View, GuardrailConfigProps>(function GuardrailConfig(
  {
    rules,
    name,
    guardrailType,
    testInput: testInputProp = '',
    showHistory = true,
    showTest = true,
    onRuleToggle,
    onSeverityChange,
    onTest,
    onAddRule,
    children,
  },
  ref,
) {
  const [state, send] = useReducer(guardrailConfigReducer, 'viewing');
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [testValue, setTestValue] = useState(testInputProp);
  const [testResults, setTestResults] = useState<TestResult[]>([]);

  const handleRuleToggle = useCallback(
    (id: string, currentEnabled: boolean) => {
      onRuleToggle?.(id, !currentEnabled);
    },
    [onRuleToggle],
  );

  const handleSeverityChange = useCallback(
    (id: string, severity: RuleSeverity) => {
      onSeverityChange?.(id, severity);
    },
    [onSeverityChange],
  );

  const handleTest = useCallback(async () => {
    if (!testValue.trim()) return;
    send({ type: 'TEST' });
    try {
      const result = await onTest?.(testValue);
      if (Array.isArray(result)) {
        setTestResults(result);
      }
    } finally {
      send({ type: 'TEST_COMPLETE' });
    }
  }, [testValue, onTest]);

  const handleRuleSelect = useCallback((id: string) => {
    setSelectedRuleId(id);
    send({ type: 'SELECT_RULE', id });
  }, []);

  const triggeredResults = testResults.filter((r) => r.triggered);

  return (
    <View ref={ref} testID="guardrail-config" accessibilityRole="none" accessibilityLabel={`Guardrail config: ${name}`} style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.guardrailName}>{name}</Text>
        <View style={s.typeBadge}>
          <Text style={s.typeBadgeText} accessibilityLabel={`Type: ${guardrailType}`}>{guardrailType}</Text>
        </View>
      </View>

      {/* Rule list */}
      <ScrollView style={s.ruleList} accessibilityRole="none" accessibilityLabel="Guardrail rules">
        {rules.map((rule) => (
          <Pressable
            key={rule.id}
            onPress={() => handleRuleSelect(rule.id)}
            accessibilityRole="none"
            accessibilityLabel={`${rule.name} \u2014 ${rule.severity}`}
            style={[s.ruleItem, selectedRuleId === rule.id && s.ruleItemSelected]}
          >
            {/* Toggle */}
            <Pressable
              onPress={() => handleRuleToggle(rule.id, rule.enabled)}
              accessibilityRole="switch"
              accessibilityState={{ checked: rule.enabled }}
              accessibilityLabel={`Toggle ${rule.name}`}
              style={[s.ruleToggle, rule.enabled ? s.toggleOn : s.toggleOff]}
            >
              <Text style={s.toggleText}>{rule.enabled ? 'On' : 'Off'}</Text>
            </Pressable>

            {/* Rule name */}
            <Text style={s.ruleName}>{rule.name}</Text>

            {/* Rule description */}
            <Text style={s.ruleDescription}>{rule.description}</Text>

            {/* Type badge */}
            <View style={s.ruleTypeBadge}>
              <Text style={s.ruleTypeText} accessibilityLabel={`Applies to: ${rule.type}`}>{rule.type}</Text>
            </View>

            {/* Severity selector */}
            <View style={s.severityRow}>
              {SEVERITY_OPTIONS.map((sev) => (
                <Pressable
                  key={sev}
                  onPress={() => handleSeverityChange(rule.id, sev)}
                  accessibilityRole="button"
                  accessibilityLabel={`Set severity to ${sev}`}
                  accessibilityState={{ selected: rule.severity === sev }}
                  style={[
                    s.severityOption,
                    rule.severity === sev && { backgroundColor: SEVERITY_COLORS[sev] },
                  ]}
                >
                  <Text style={[s.severityText, rule.severity === sev && s.severityTextActive]}>{sev}</Text>
                </Pressable>
              ))}
            </View>

            {/* History placeholder */}
            {showHistory && <View style={s.ruleHistory} />}
          </Pressable>
        ))}
      </ScrollView>

      {/* Add rule button */}
      <Pressable
        onPress={() => {
          send({ type: 'ADD_RULE' });
          onAddRule?.();
        }}
        accessibilityRole="button"
        accessibilityLabel="Add new custom rule"
        style={s.addButton}
      >
        <Text style={s.addButtonText}>{children ?? 'Add Rule'}</Text>
      </Pressable>

      {/* Test area */}
      {showTest && (
        <View style={s.testArea} accessibilityRole="none" accessibilityLabel="Rule tester">
          <TextInput
            style={s.testInput}
            placeholder="Enter test input..."
            value={testValue}
            onChangeText={setTestValue}
            multiline
            numberOfLines={3}
            accessibilityLabel="Test input for validating rules"
          />

          <Pressable
            onPress={handleTest}
            accessibilityRole="button"
            accessibilityLabel="Test rules against input"
            accessibilityState={{ disabled: state === 'testing' || !testValue.trim() }}
            disabled={state === 'testing' || !testValue.trim()}
            style={[s.testButton, (state === 'testing' || !testValue.trim()) && s.testButtonDisabled]}
          >
            <Text style={s.testButtonText}>{state === 'testing' ? 'Testing...' : 'Test'}</Text>
          </Pressable>

          {/* Test results */}
          {testResults.length > 0 && (
            <View style={s.testResults} accessibilityRole="none" accessibilityLabel="Test results">
              <Text style={s.testSummary}>
                {triggeredResults.length === 0
                  ? 'All rules passed'
                  : `${triggeredResults.length} rule${triggeredResults.length === 1 ? '' : 's'} triggered`}
              </Text>
              {testResults.map((result) => (
                <View key={result.ruleId} style={s.testResultItem}>
                  <Text style={s.testResultName}>{result.ruleName}</Text>
                  <Text style={[s.testResultStatus, result.triggered && { color: SEVERITY_COLORS[result.severity] }]}>
                    {result.triggered ? result.severity : 'pass'}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
});

const s = StyleSheet.create({
  root: { padding: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  guardrailName: { fontSize: 16, fontWeight: '700' },
  typeBadge: { backgroundColor: '#e0e7ff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  typeBadgeText: { fontSize: 12, color: '#4338ca', fontWeight: '600' },
  ruleList: { marginBottom: 12 },
  ruleItem: { padding: 12, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, marginBottom: 8 },
  ruleItemSelected: { borderColor: '#6366f1', backgroundColor: '#f5f3ff' },
  ruleToggle: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginBottom: 6, alignSelf: 'flex-start' },
  toggleOn: { backgroundColor: '#22c55e' },
  toggleOff: { backgroundColor: '#d1d5db' },
  toggleText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  ruleName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  ruleDescription: { fontSize: 12, color: '#6b7280', marginBottom: 6 },
  ruleTypeBadge: { alignSelf: 'flex-start', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1, marginBottom: 6 },
  ruleTypeText: { fontSize: 11, color: '#6b7280' },
  severityRow: { flexDirection: 'row', gap: 4, marginBottom: 4 },
  severityOption: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, borderWidth: 1, borderColor: '#d1d5db' },
  severityText: { fontSize: 11, fontWeight: '600', color: '#374151' },
  severityTextActive: { color: '#fff' },
  ruleHistory: { height: 4, backgroundColor: '#e5e7eb', borderRadius: 2, marginTop: 4 },
  addButton: { backgroundColor: '#6366f1', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 6, alignItems: 'center', marginBottom: 12 },
  addButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  testArea: { borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 12 },
  testInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, padding: 8, fontSize: 14, minHeight: 60, textAlignVertical: 'top', marginBottom: 8 },
  testButton: { backgroundColor: '#3b82f6', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6, alignItems: 'center', marginBottom: 8 },
  testButtonDisabled: { opacity: 0.5 },
  testButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  testResults: { marginTop: 4 },
  testSummary: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  testResultItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  testResultName: { fontSize: 13 },
  testResultStatus: { fontSize: 13, fontWeight: '600', color: '#22c55e' },
});

GuardrailConfig.displayName = 'GuardrailConfig';
export { GuardrailConfig };
export default GuardrailConfig;
