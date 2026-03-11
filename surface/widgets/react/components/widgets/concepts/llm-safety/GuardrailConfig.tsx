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

import {
  forwardRef,
  useReducer,
  useRef,
  useState,
  useCallback,
  useId,
  type HTMLAttributes,
  type ReactNode,
  type KeyboardEvent,
} from 'react';

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

export interface GuardrailConfigProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
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

const GuardrailConfig = forwardRef<HTMLDivElement, GuardrailConfigProps>(function GuardrailConfig(
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
    ...restProps
  },
  ref,
) {
  const [state, send] = useReducer(guardrailConfigReducer, 'viewing');
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [testValue, setTestValue] = useState(testInputProp);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const ruleListRef = useRef<HTMLDivElement>(null);
  const testAreaId = useId();

  const focusRuleAtIndex = useCallback((index: number) => {
    const items = ruleListRef.current?.querySelectorAll<HTMLElement>('[data-part="rule-item"]');
    if (!items || items.length === 0) return;
    const clamped = Math.max(0, Math.min(index, items.length - 1));
    setFocusedIndex(clamped);
    items[clamped]?.focus();
  }, []);

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

  const handleRuleSelect = useCallback(
    (id: string) => {
      setSelectedRuleId(id);
      send({ type: 'SELECT_RULE', id });
    },
    [],
  );

  const handleRootKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      // Only handle keys when focus is within the rule list or on the root
      if (e.key === 'Escape') {
        e.preventDefault();
        setSelectedRuleId(null);
        send({ type: 'DESELECT' });
        return;
      }
    },
    [],
  );

  const handleRuleListKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        focusRuleAtIndex(focusedIndex + 1);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        focusRuleAtIndex(focusedIndex - 1);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const rule = rules[focusedIndex];
        if (rule) handleRuleSelect(rule.id);
        return;
      }
      if (e.key === 't') {
        // Only trigger test shortcut when not in an input
        const target = e.target as HTMLElement;
        if (target.tagName !== 'TEXTAREA' && target.tagName !== 'INPUT') {
          e.preventDefault();
          handleTest();
        }
      }
    },
    [focusedIndex, focusRuleAtIndex, rules, handleRuleSelect, handleTest],
  );

  const triggeredResults = testResults.filter((r) => r.triggered);

  return (
    <div
      ref={ref}
      role="form"
      aria-label={`Guardrail config: ${name}`}
      data-surface-widget=""
      data-widget-name="guardrail-config"
      data-part="root"
      data-state={state}
      onKeyDown={handleRootKeyDown}
      tabIndex={0}
      {...restProps}
    >
      {/* Header: guardrail name and type badge */}
      <div data-part="header" data-state={state}>
        <span data-part="guardrail-name">{name}</span>
        <span
          data-part="type-badge"
          data-type={guardrailType}
          aria-label={`Type: ${guardrailType}`}
        >
          {guardrailType}
        </span>
      </div>

      {/* Rule list */}
      <div
        ref={ruleListRef}
        data-part="rule-list"
        data-state={state}
        role="list"
        aria-label="Guardrail rules"
        onKeyDown={handleRuleListKeyDown}
      >
        {rules.map((rule, index) => (
          <div
            key={rule.id}
            data-part="rule-item"
            data-state={state}
            data-selected={selectedRuleId === rule.id ? 'true' : 'false'}
            data-enabled={rule.enabled ? 'true' : 'false'}
            data-severity={rule.severity}
            role="listitem"
            aria-label={`${rule.name} \u2014 ${rule.severity}`}
            tabIndex={index === focusedIndex ? 0 : -1}
            onClick={() => handleRuleSelect(rule.id)}
          >
            {/* Toggle switch */}
            <button
              type="button"
              data-part="rule-toggle"
              data-state={state}
              role="switch"
              aria-checked={rule.enabled}
              aria-label={`Toggle ${rule.name}`}
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                handleRuleToggle(rule.id, rule.enabled);
              }}
              onKeyDown={(e) => {
                if (e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  handleRuleToggle(rule.id, rule.enabled);
                }
              }}
            >
              {rule.enabled ? 'On' : 'Off'}
            </button>

            {/* Rule name */}
            <span data-part="rule-name" data-state={state}>
              {rule.name}
            </span>

            {/* Rule description */}
            <span data-part="rule-description" data-state={state}>
              {rule.description}
            </span>

            {/* Type badge */}
            <span
              data-part="rule-type"
              data-type={rule.type}
              aria-label={`Applies to: ${rule.type}`}
            >
              {rule.type}
            </span>

            {/* Severity badge / selector */}
            <div
              data-part="rule-severity"
              data-state={state}
              data-severity={rule.severity}
            >
              {SEVERITY_OPTIONS.map((sev) => (
                <button
                  key={sev}
                  type="button"
                  data-part="severity-option"
                  data-severity={sev}
                  data-active={rule.severity === sev ? 'true' : 'false'}
                  aria-pressed={rule.severity === sev}
                  aria-label={`Set severity to ${sev}`}
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSeverityChange(rule.id, sev);
                  }}
                >
                  {sev}
                </button>
              ))}
            </div>

            {/* Rule history sparkline placeholder */}
            {showHistory && (
              <div
                data-part="rule-history"
                data-state={state}
                data-visible="true"
                aria-hidden="true"
              />
            )}
          </div>
        ))}
      </div>

      {/* Add rule button */}
      <button
        type="button"
        data-part="add"
        data-state={state}
        aria-label="Add new custom rule"
        tabIndex={0}
        onClick={() => {
          send({ type: 'ADD_RULE' });
          onAddRule?.();
        }}
      >
        {children ?? 'Add Rule'}
      </button>

      {/* Test area */}
      {showTest && (
        <div
          data-part="test"
          data-state={state}
          data-visible="true"
          role="region"
          aria-label="Rule tester"
          id={testAreaId}
        >
          <textarea
            data-part="test-input"
            data-state={state}
            aria-label="Test input for validating rules"
            placeholder="Enter test input..."
            value={testValue}
            rows={3}
            onChange={(e) => setTestValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                handleTest();
              }
            }}
          />

          <button
            type="button"
            data-part="test-button"
            data-state={state}
            aria-label="Test rules against input"
            tabIndex={0}
            disabled={state === 'testing' || !testValue.trim()}
            onClick={handleTest}
          >
            {state === 'testing' ? 'Testing...' : 'Test'}
          </button>

          {/* Test results */}
          <div
            data-part="test-result"
            data-state={state}
            data-has-results={testResults.length > 0 ? 'true' : 'false'}
            role="status"
            aria-live="polite"
          >
            {testResults.length > 0 && (
              <>
                <span data-part="test-summary">
                  {triggeredResults.length === 0
                    ? 'All rules passed'
                    : `${triggeredResults.length} rule${triggeredResults.length === 1 ? '' : 's'} triggered`}
                </span>
                <ul data-part="test-result-list" role="list">
                  {testResults.map((result) => (
                    <li
                      key={result.ruleId}
                      data-part="test-result-item"
                      data-triggered={result.triggered ? 'true' : 'false'}
                      data-severity={result.severity}
                    >
                      <span data-part="test-result-name">{result.ruleName}</span>
                      <span data-part="test-result-status">
                        {result.triggered ? result.severity : 'pass'}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

GuardrailConfig.displayName = 'GuardrailConfig';
export { GuardrailConfig };
export default GuardrailConfig;
