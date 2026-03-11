/* ---------------------------------------------------------------------------
 * GuardrailConfig — Vanilla implementation
 *
 * Configuration panel for guardrail rules with toggle switches, severity
 * labels, test input/result panel, and add rule form.
 * ------------------------------------------------------------------------- */

export type GuardrailConfigState = 'viewing' | 'ruleSelected' | 'testing' | 'adding';
export type GuardrailConfigEvent = | { type: 'SELECT_RULE' } | { type: 'TEST' } | { type: 'ADD_RULE' } | { type: 'DESELECT' } | { type: 'TEST_COMPLETE' } | { type: 'SAVE' } | { type: 'CANCEL' };

export function guardrailConfigReducer(state: GuardrailConfigState, event: GuardrailConfigEvent): GuardrailConfigState {
  switch (state) {
    case 'viewing': if (event.type === 'SELECT_RULE') return 'ruleSelected'; if (event.type === 'TEST') return 'testing'; if (event.type === 'ADD_RULE') return 'adding'; return state;
    case 'ruleSelected': if (event.type === 'DESELECT') return 'viewing'; return state;
    case 'testing': if (event.type === 'TEST_COMPLETE') return 'viewing'; return state;
    case 'adding': if (event.type === 'SAVE') return 'viewing'; if (event.type === 'CANCEL') return 'viewing'; return state;
    default: return state;
  }
}

export interface GuardrailRule { id: string; name: string; enabled: boolean; severity: 'info' | 'warning' | 'error' | 'critical'; description?: string; }

export interface GuardrailConfigProps {
  [key: string]: unknown; className?: string;
  rules?: GuardrailRule[];
  testInput?: string; testResult?: string;
  onToggleRule?: (id: string, enabled: boolean) => void;
  onTest?: (input: string) => void;
  onAddRule?: (rule: Partial<GuardrailRule>) => void;
}
export interface GuardrailConfigOptions { target: HTMLElement; props: GuardrailConfigProps; }

let _guardrailConfigUid = 0;

export class GuardrailConfig {
  private el: HTMLElement;
  private props: GuardrailConfigProps;
  private state: GuardrailConfigState = 'viewing';
  private disposers: Array<() => void> = [];
  private selectedRuleId: string | null = null;
  private testInputValue = '';

  constructor(options: GuardrailConfigOptions) {
    this.props = { ...options.props };
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'guardrail-config');
    this.el.setAttribute('data-part', 'root');
    this.el.setAttribute('role', 'form');
    this.el.setAttribute('aria-label', 'Guardrail configuration');
    this.el.setAttribute('tabindex', '0');
    this.el.id = 'guardrail-config-' + (++_guardrailConfigUid);
    this.render();
    options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }
  send(type: string): void { this.state = guardrailConfigReducer(this.state, { type } as any); this.el.setAttribute('data-state', this.state); }
  update(props: Partial<GuardrailConfigProps>): void { Object.assign(this.props, props); this.cleanup(); this.el.innerHTML = ''; this.render(); }
  destroy(): void { this.cleanup(); this.el.remove(); }
  private cleanup(): void { for (const d of this.disposers) d(); this.disposers = []; }
  private rerender(): void { this.cleanup(); this.el.innerHTML = ''; this.render(); }

  private render(): void {
    const rules = (this.props.rules ?? []) as GuardrailRule[];
    this.el.setAttribute('data-state', this.state);
    if (this.props.className) this.el.className = this.props.className;

    // Header
    const header = document.createElement('div');
    header.setAttribute('data-part', 'header');
    header.textContent = `Guardrails (${rules.filter(r => r.enabled).length}/${rules.length} active)`;
    this.el.appendChild(header);

    // Rule list
    const ruleList = document.createElement('div');
    ruleList.setAttribute('data-part', 'rule-list');
    ruleList.setAttribute('role', 'list');
    for (const rule of rules) {
      const item = document.createElement('div');
      item.setAttribute('data-part', 'rule-item');
      item.setAttribute('role', 'listitem');
      item.setAttribute('data-selected', this.selectedRuleId === rule.id ? 'true' : 'false');
      item.setAttribute('data-severity', rule.severity);

      const toggle = document.createElement('input');
      toggle.setAttribute('data-part', 'rule-toggle');
      toggle.setAttribute('type', 'checkbox');
      toggle.setAttribute('role', 'switch');
      toggle.setAttribute('aria-label', `Enable ${rule.name}`);
      toggle.checked = rule.enabled;
      const onToggle = () => this.props.onToggleRule?.(rule.id, toggle.checked);
      toggle.addEventListener('change', onToggle);
      this.disposers.push(() => toggle.removeEventListener('change', onToggle));
      item.appendChild(toggle);

      const name = document.createElement('span');
      name.setAttribute('data-part', 'rule-name');
      name.textContent = rule.name;
      item.appendChild(name);

      const severity = document.createElement('span');
      severity.setAttribute('data-part', 'rule-severity');
      severity.setAttribute('data-severity', rule.severity);
      severity.textContent = rule.severity;
      item.appendChild(severity);

      if (rule.description) {
        const desc = document.createElement('span');
        desc.setAttribute('data-part', 'rule-description');
        desc.textContent = rule.description;
        item.appendChild(desc);
      }

      const onClick = () => { this.selectedRuleId = rule.id; this.send('SELECT_RULE'); this.rerender(); };
      item.addEventListener('click', onClick);
      this.disposers.push(() => item.removeEventListener('click', onClick));
      ruleList.appendChild(item);
    }
    this.el.appendChild(ruleList);

    // Add button
    const addBtn = document.createElement('button');
    addBtn.setAttribute('data-part', 'add-button');
    addBtn.setAttribute('type', 'button');
    addBtn.textContent = '+ Add Rule';
    const onAdd = () => { this.send('ADD_RULE'); this.rerender(); };
    addBtn.addEventListener('click', onAdd);
    this.disposers.push(() => addBtn.removeEventListener('click', onAdd));
    this.el.appendChild(addBtn);

    // Test panel
    const testPanel = document.createElement('div');
    testPanel.setAttribute('data-part', 'test-panel');
    const testInput = document.createElement('textarea');
    testInput.setAttribute('data-part', 'test-input');
    testInput.setAttribute('placeholder', 'Enter text to test guardrails...');
    testInput.setAttribute('aria-label', 'Test input');
    testInput.setAttribute('rows', '3');
    testInput.value = this.testInputValue;
    const onInputChange = () => { this.testInputValue = testInput.value; };
    testInput.addEventListener('input', onInputChange);
    this.disposers.push(() => testInput.removeEventListener('input', onInputChange));
    testPanel.appendChild(testInput);

    const testBtn = document.createElement('button');
    testBtn.setAttribute('type', 'button');
    testBtn.textContent = this.state === 'testing' ? 'Testing...' : 'Test';
    if (this.state === 'testing') testBtn.setAttribute('disabled', '');
    const onTest = () => { this.send('TEST'); this.props.onTest?.(this.testInputValue); };
    testBtn.addEventListener('click', onTest);
    this.disposers.push(() => testBtn.removeEventListener('click', onTest));
    testPanel.appendChild(testBtn);

    if (this.props.testResult) {
      const testResult = document.createElement('div');
      testResult.setAttribute('data-part', 'test-result');
      testResult.textContent = this.props.testResult as string;
      testPanel.appendChild(testResult);
    }
    this.el.appendChild(testPanel);
  }
}

export default GuardrailConfig;
