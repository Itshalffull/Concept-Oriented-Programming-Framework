import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

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

type RuleSeverity = 'block' | 'warn' | 'log';
type RuleType = 'input' | 'output' | 'both';

interface GuardrailRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  type: RuleType;
  severity: RuleSeverity;
}

interface TestResult {
  ruleId: string;
  ruleName: string;
  triggered: boolean;
  severity: RuleSeverity;
}

const SEVERITY_OPTIONS: RuleSeverity[] = ['block', 'warn', 'log'];

export interface GuardrailConfigProps { [key: string]: unknown; class?: string; }
export interface GuardrailConfigResult { element: HTMLElement; dispose: () => void; }

export function GuardrailConfig(props: GuardrailConfigProps): GuardrailConfigResult {
  const sig = surfaceCreateSignal<GuardrailConfigState>('viewing');
  const send = (event: GuardrailConfigEvent) => { sig.set(guardrailConfigReducer(sig.get(), event)); };

  const rules = (props.rules ?? []) as GuardrailRule[];
  const name = String(props.name ?? '');
  const guardrailType = String(props.guardrailType ?? '');
  const testInputProp = String(props.testInput ?? '');
  const showHistory = props.showHistory !== false;
  const showTest = props.showTest !== false;
  const onRuleToggle = props.onRuleToggle as ((id: string, enabled: boolean) => void) | undefined;
  const onSeverityChange = props.onSeverityChange as ((id: string, severity: RuleSeverity) => void) | undefined;
  const onTest = props.onTest as ((input: string) => void | TestResult[] | Promise<TestResult[]>) | undefined;
  const onAddRule = props.onAddRule as (() => void) | undefined;

  let selectedRuleId: string | null = null;
  let testValue = testInputProp;
  let testResults: TestResult[] = [];
  let focusedIndex = 0;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'guardrail-config');
  root.setAttribute('data-part', 'root');
  root.setAttribute('data-state', sig.get());
  root.setAttribute('role', 'form');
  root.setAttribute('aria-label', `Guardrail config: ${name}`);
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  // Header
  const headerEl = document.createElement('div');
  headerEl.setAttribute('data-part', 'header');
  headerEl.setAttribute('data-state', sig.get());
  root.appendChild(headerEl);

  const nameEl = document.createElement('span');
  nameEl.setAttribute('data-part', 'guardrail-name');
  nameEl.textContent = name;
  headerEl.appendChild(nameEl);

  const typeBadge = document.createElement('span');
  typeBadge.setAttribute('data-part', 'type-badge');
  typeBadge.setAttribute('data-type', guardrailType);
  typeBadge.setAttribute('aria-label', `Type: ${guardrailType}`);
  typeBadge.textContent = guardrailType;
  headerEl.appendChild(typeBadge);

  // Rule list
  const ruleListEl = document.createElement('div');
  ruleListEl.setAttribute('data-part', 'rule-list');
  ruleListEl.setAttribute('data-state', sig.get());
  ruleListEl.setAttribute('role', 'list');
  ruleListEl.setAttribute('aria-label', 'Guardrail rules');
  root.appendChild(ruleListEl);

  const renderRules = () => {
    ruleListEl.innerHTML = '';

    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      const isSelected = selectedRuleId === rule.id;

      const itemEl = document.createElement('div');
      itemEl.setAttribute('data-part', 'rule-item');
      itemEl.setAttribute('data-state', sig.get());
      itemEl.setAttribute('data-selected', isSelected ? 'true' : 'false');
      itemEl.setAttribute('data-enabled', rule.enabled ? 'true' : 'false');
      itemEl.setAttribute('data-severity', rule.severity);
      itemEl.setAttribute('role', 'listitem');
      itemEl.setAttribute('aria-label', `${rule.name} \u2014 ${rule.severity}`);
      itemEl.setAttribute('tabindex', i === focusedIndex ? '0' : '-1');

      itemEl.addEventListener('click', () => {
        selectedRuleId = rule.id;
        send({ type: 'SELECT_RULE' });
        renderRules();
      });

      // Toggle switch
      const toggleBtn = document.createElement('button');
      toggleBtn.setAttribute('type', 'button');
      toggleBtn.setAttribute('data-part', 'rule-toggle');
      toggleBtn.setAttribute('data-state', sig.get());
      toggleBtn.setAttribute('role', 'switch');
      toggleBtn.setAttribute('aria-checked', String(rule.enabled));
      toggleBtn.setAttribute('aria-label', `Toggle ${rule.name}`);
      toggleBtn.setAttribute('tabindex', '0');
      toggleBtn.textContent = rule.enabled ? 'On' : 'Off';
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onRuleToggle?.(rule.id, !rule.enabled);
      });
      toggleBtn.addEventListener('keydown', (e) => {
        if (e.key === ' ') { e.preventDefault(); e.stopPropagation(); onRuleToggle?.(rule.id, !rule.enabled); }
      });
      itemEl.appendChild(toggleBtn);

      // Rule name
      const ruleNameEl = document.createElement('span');
      ruleNameEl.setAttribute('data-part', 'rule-name');
      ruleNameEl.setAttribute('data-state', sig.get());
      ruleNameEl.textContent = rule.name;
      itemEl.appendChild(ruleNameEl);

      // Rule description
      const ruleDescEl = document.createElement('span');
      ruleDescEl.setAttribute('data-part', 'rule-description');
      ruleDescEl.setAttribute('data-state', sig.get());
      ruleDescEl.textContent = rule.description;
      itemEl.appendChild(ruleDescEl);

      // Type badge
      const ruleTypeBadge = document.createElement('span');
      ruleTypeBadge.setAttribute('data-part', 'rule-type');
      ruleTypeBadge.setAttribute('data-type', rule.type);
      ruleTypeBadge.setAttribute('aria-label', `Applies to: ${rule.type}`);
      ruleTypeBadge.textContent = rule.type;
      itemEl.appendChild(ruleTypeBadge);

      // Severity selector
      const severityDiv = document.createElement('div');
      severityDiv.setAttribute('data-part', 'rule-severity');
      severityDiv.setAttribute('data-state', sig.get());
      severityDiv.setAttribute('data-severity', rule.severity);

      for (const sev of SEVERITY_OPTIONS) {
        const sevBtn = document.createElement('button');
        sevBtn.setAttribute('type', 'button');
        sevBtn.setAttribute('data-part', 'severity-option');
        sevBtn.setAttribute('data-severity', sev);
        sevBtn.setAttribute('data-active', rule.severity === sev ? 'true' : 'false');
        sevBtn.setAttribute('aria-pressed', String(rule.severity === sev));
        sevBtn.setAttribute('aria-label', `Set severity to ${sev}`);
        sevBtn.setAttribute('tabindex', '0');
        sevBtn.textContent = sev;
        sevBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          onSeverityChange?.(rule.id, sev);
        });
        severityDiv.appendChild(sevBtn);
      }
      itemEl.appendChild(severityDiv);

      // History placeholder
      if (showHistory) {
        const historyEl = document.createElement('div');
        historyEl.setAttribute('data-part', 'rule-history');
        historyEl.setAttribute('data-state', sig.get());
        historyEl.setAttribute('data-visible', 'true');
        historyEl.setAttribute('aria-hidden', 'true');
        itemEl.appendChild(historyEl);
      }

      ruleListEl.appendChild(itemEl);
    }
  };

  // Add rule button
  const addBtnEl = document.createElement('button');
  addBtnEl.setAttribute('type', 'button');
  addBtnEl.setAttribute('data-part', 'add');
  addBtnEl.setAttribute('data-state', sig.get());
  addBtnEl.setAttribute('aria-label', 'Add new custom rule');
  addBtnEl.setAttribute('tabindex', '0');
  addBtnEl.textContent = 'Add Rule';
  addBtnEl.addEventListener('click', () => {
    send({ type: 'ADD_RULE' });
    onAddRule?.();
  });
  root.appendChild(addBtnEl);

  // Test area
  let testAreaEl: HTMLElement | null = null;
  let testInputEl: HTMLTextAreaElement | null = null;
  let testButtonEl: HTMLButtonElement | null = null;
  let testResultEl: HTMLElement | null = null;

  if (showTest) {
    testAreaEl = document.createElement('div');
    testAreaEl.setAttribute('data-part', 'test');
    testAreaEl.setAttribute('data-state', sig.get());
    testAreaEl.setAttribute('data-visible', 'true');
    testAreaEl.setAttribute('role', 'region');
    testAreaEl.setAttribute('aria-label', 'Rule tester');
    root.appendChild(testAreaEl);

    testInputEl = document.createElement('textarea');
    testInputEl.setAttribute('data-part', 'test-input');
    testInputEl.setAttribute('data-state', sig.get());
    testInputEl.setAttribute('aria-label', 'Test input for validating rules');
    testInputEl.placeholder = 'Enter test input...';
    testInputEl.rows = 3;
    testInputEl.value = testValue;
    testInputEl.addEventListener('input', () => { testValue = testInputEl!.value; });
    testInputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); handleTest(); }
    });
    testAreaEl.appendChild(testInputEl);

    testButtonEl = document.createElement('button');
    testButtonEl.setAttribute('type', 'button');
    testButtonEl.setAttribute('data-part', 'test-button');
    testButtonEl.setAttribute('data-state', sig.get());
    testButtonEl.setAttribute('aria-label', 'Test rules against input');
    testButtonEl.setAttribute('tabindex', '0');
    testButtonEl.textContent = 'Test';
    testButtonEl.addEventListener('click', () => { handleTest(); });
    testAreaEl.appendChild(testButtonEl);

    testResultEl = document.createElement('div');
    testResultEl.setAttribute('data-part', 'test-result');
    testResultEl.setAttribute('data-state', sig.get());
    testResultEl.setAttribute('data-has-results', 'false');
    testResultEl.setAttribute('role', 'status');
    testResultEl.setAttribute('aria-live', 'polite');
    testAreaEl.appendChild(testResultEl);
  }

  const handleTest = async () => {
    if (!testValue.trim()) return;
    send({ type: 'TEST' });
    if (testButtonEl) { testButtonEl.disabled = true; testButtonEl.textContent = 'Testing...'; }
    try {
      const result = await onTest?.(testValue);
      if (Array.isArray(result)) testResults = result;
    } finally {
      send({ type: 'TEST_COMPLETE' });
      if (testButtonEl) { testButtonEl.disabled = false; testButtonEl.textContent = 'Test'; }
      renderTestResults();
    }
  };

  const renderTestResults = () => {
    if (!testResultEl) return;
    testResultEl.innerHTML = '';
    testResultEl.setAttribute('data-has-results', testResults.length > 0 ? 'true' : 'false');

    if (testResults.length === 0) return;

    const triggered = testResults.filter(r => r.triggered);

    const summary = document.createElement('span');
    summary.setAttribute('data-part', 'test-summary');
    summary.textContent = triggered.length === 0
      ? 'All rules passed'
      : `${triggered.length} rule${triggered.length === 1 ? '' : 's'} triggered`;
    testResultEl.appendChild(summary);

    const ul = document.createElement('ul');
    ul.setAttribute('data-part', 'test-result-list');
    ul.setAttribute('role', 'list');

    for (const result of testResults) {
      const li = document.createElement('li');
      li.setAttribute('data-part', 'test-result-item');
      li.setAttribute('data-triggered', result.triggered ? 'true' : 'false');
      li.setAttribute('data-severity', result.severity);

      const nameSpan = document.createElement('span');
      nameSpan.setAttribute('data-part', 'test-result-name');
      nameSpan.textContent = result.ruleName;
      li.appendChild(nameSpan);

      const statusSpan = document.createElement('span');
      statusSpan.setAttribute('data-part', 'test-result-status');
      statusSpan.textContent = result.triggered ? result.severity : 'pass';
      li.appendChild(statusSpan);

      ul.appendChild(li);
    }
    testResultEl.appendChild(ul);
  };

  // Keyboard on rule list
  ruleListEl.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusedIndex = Math.min(focusedIndex + 1, rules.length - 1);
      renderRules();
      const items = ruleListEl.querySelectorAll<HTMLElement>('[data-part="rule-item"]');
      items[focusedIndex]?.focus();
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusedIndex = Math.max(focusedIndex - 1, 0);
      renderRules();
      const items = ruleListEl.querySelectorAll<HTMLElement>('[data-part="rule-item"]');
      items[focusedIndex]?.focus();
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const rule = rules[focusedIndex];
      if (rule) { selectedRuleId = rule.id; send({ type: 'SELECT_RULE' }); renderRules(); }
    }
    if (e.key === 't') {
      const target = e.target as HTMLElement;
      if (target.tagName !== 'TEXTAREA' && target.tagName !== 'INPUT') {
        e.preventDefault();
        handleTest();
      }
    }
  });

  // Root keyboard
  root.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      selectedRuleId = null;
      send({ type: 'DESELECT' });
      renderRules();
    }
  });

  // Initial render
  renderRules();

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    headerEl.setAttribute('data-state', s);
    ruleListEl.setAttribute('data-state', s);
    addBtnEl.setAttribute('data-state', s);
    if (testAreaEl) testAreaEl.setAttribute('data-state', s);
    if (testInputEl) testInputEl.setAttribute('data-state', s);
    if (testButtonEl) {
      testButtonEl.setAttribute('data-state', s);
      testButtonEl.disabled = s === 'testing' || !testValue.trim();
      testButtonEl.textContent = s === 'testing' ? 'Testing...' : 'Test';
    }
    if (testResultEl) testResultEl.setAttribute('data-state', s);
  });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default GuardrailConfig;
