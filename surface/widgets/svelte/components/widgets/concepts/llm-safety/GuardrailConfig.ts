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

export interface GuardrailConfigProps { [key: string]: unknown; class?: string; }
export interface GuardrailConfigResult { element: HTMLElement; dispose: () => void; }

export function GuardrailConfig(props: GuardrailConfigProps): GuardrailConfigResult {
  const sig = surfaceCreateSignal<GuardrailConfigState>('viewing');
  const state = () => sig.get();
  const send = (type: string) => sig.set(guardrailConfigReducer(sig.get(), { type } as any));

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'guardrail-config');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'form');
  root.setAttribute('aria-label', 'Guardrail configuration');
  root.setAttribute('data-state', state());
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  root.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      const s = sig.get();
      if (s === 'ruleSelected') send('DESELECT');
      if (s === 'adding') send('CANCEL');
    }
  });

  const headerEl = document.createElement('div');
  headerEl.setAttribute('data-part', 'header');
  root.appendChild(headerEl);

  const ruleListEl = document.createElement('div');
  ruleListEl.setAttribute('data-part', 'rule-list');
  ruleListEl.setAttribute('role', 'list');
  ruleListEl.setAttribute('aria-label', 'Guardrail rules');
  root.appendChild(ruleListEl);

  const ruleItemEl = document.createElement('div');
  ruleItemEl.setAttribute('data-part', 'rule-item');
  ruleItemEl.setAttribute('role', 'listitem');
  ruleItemEl.setAttribute('tabindex', '-1');
  ruleItemEl.addEventListener('click', () => send('SELECT_RULE'));
  ruleListEl.appendChild(ruleItemEl);

  const ruleToggleEl = document.createElement('button');
  ruleToggleEl.setAttribute('type', 'button');
  ruleToggleEl.setAttribute('data-part', 'rule-toggle');
  ruleToggleEl.setAttribute('role', 'switch');
  ruleToggleEl.setAttribute('aria-label', 'Toggle rule');
  ruleItemEl.appendChild(ruleToggleEl);

  const ruleNameEl = document.createElement('span');
  ruleNameEl.setAttribute('data-part', 'rule-name');
  ruleItemEl.appendChild(ruleNameEl);

  const ruleSeverityEl = document.createElement('span');
  ruleSeverityEl.setAttribute('data-part', 'rule-severity');
  ruleItemEl.appendChild(ruleSeverityEl);

  const ruleHistoryEl = document.createElement('div');
  ruleHistoryEl.setAttribute('data-part', 'rule-history');
  ruleHistoryEl.setAttribute('aria-label', 'Rule trigger history');
  ruleItemEl.appendChild(ruleHistoryEl);

  const addButtonEl = document.createElement('button');
  addButtonEl.setAttribute('type', 'button');
  addButtonEl.setAttribute('data-part', 'add-button');
  addButtonEl.setAttribute('aria-label', 'Add new rule');
  addButtonEl.setAttribute('tabindex', '0');
  addButtonEl.textContent = '+ Add Rule';
  addButtonEl.addEventListener('click', () => send('ADD_RULE'));
  root.appendChild(addButtonEl);

  const testPanelEl = document.createElement('div');
  testPanelEl.setAttribute('data-part', 'test-panel');
  testPanelEl.setAttribute('role', 'region');
  testPanelEl.setAttribute('aria-label', 'Test guardrails');
  root.appendChild(testPanelEl);

  const testInputEl = document.createElement('textarea');
  testInputEl.setAttribute('data-part', 'test-input');
  testInputEl.setAttribute('aria-label', 'Test input');
  testInputEl.setAttribute('placeholder', 'Enter test input...');
  testPanelEl.appendChild(testInputEl);

  const testButtonEl = document.createElement('button');
  testButtonEl.setAttribute('type', 'button');
  testButtonEl.setAttribute('data-part', 'test-button');
  testButtonEl.setAttribute('aria-label', 'Run test');
  testButtonEl.setAttribute('tabindex', '0');
  testButtonEl.textContent = 'Test';
  testButtonEl.addEventListener('click', () => send('TEST'));
  testPanelEl.appendChild(testButtonEl);

  const testResultEl = document.createElement('div');
  testResultEl.setAttribute('data-part', 'test-result');
  testResultEl.setAttribute('role', 'status');
  testResultEl.setAttribute('aria-live', 'polite');
  testPanelEl.appendChild(testResultEl);

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    headerEl.setAttribute('data-state', s);
    ruleItemEl.setAttribute('data-selected', s === 'ruleSelected' ? 'true' : 'false');
    testButtonEl.disabled = s === 'testing';
    testButtonEl.textContent = s === 'testing' ? 'Testing...' : 'Test';
    addButtonEl.setAttribute('data-state', s);
  });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default GuardrailConfig;
