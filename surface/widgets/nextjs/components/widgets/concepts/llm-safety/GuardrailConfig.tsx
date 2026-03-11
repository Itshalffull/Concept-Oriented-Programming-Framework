/* ---------------------------------------------------------------------------
 * GuardrailConfig — Server Component
 *
 * Configuration panel for safety guardrails showing rule list with
 * toggle/severity controls, test area with results.
 * ------------------------------------------------------------------------- */

import type { ReactNode } from 'react';

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

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
  /** Pre-computed test results for static display. */
  testResults?: TestResult[];
  /** ID of the selected rule. */
  selectedRuleId?: string | undefined;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Constants
 * ------------------------------------------------------------------------- */

const SEVERITY_OPTIONS: RuleSeverity[] = ['block', 'warn', 'log'];

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export default function GuardrailConfig({
  rules,
  name,
  guardrailType,
  testInput: _testInputProp = '',
  showHistory = true,
  showTest = true,
  testResults = [],
  selectedRuleId,
  children,
}: GuardrailConfigProps) {
  const state = selectedRuleId ? 'ruleSelected' : 'viewing';
  const triggeredResults = testResults.filter((r) => r.triggered);

  return (
    <div
      role="form"
      aria-label={`Guardrail config: ${name}`}
      data-surface-widget=""
      data-widget-name="guardrail-config"
      data-part="root"
      data-state={state}
      tabIndex={0}
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
        data-part="rule-list"
        data-state={state}
        role="list"
        aria-label="Guardrail rules"
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
            tabIndex={index === 0 ? 0 : -1}
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
        >
          <textarea
            data-part="test-input"
            data-state={state}
            aria-label="Test input for validating rules"
            placeholder="Enter test input..."
            rows={3}
          />

          <button
            type="button"
            data-part="test-button"
            data-state={state}
            aria-label="Test rules against input"
            tabIndex={0}
          >
            Test
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
}

export { GuardrailConfig };
