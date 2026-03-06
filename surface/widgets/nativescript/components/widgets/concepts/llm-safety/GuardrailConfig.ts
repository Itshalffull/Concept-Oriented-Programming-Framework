import {
  StackLayout,
  Label,
  Button,
  ScrollView,
  TextView,
  Switch,
} from '@nativescript/core';

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
}

const SEVERITY_OPTIONS: RuleSeverity[] = ['block', 'warn', 'log'];

export function createGuardrailConfig(props: GuardrailConfigProps): {
  view: StackLayout;
  dispose: () => void;
} {
  let state: GuardrailConfigState = 'viewing';
  let selectedRuleId: string | null = null;
  let testValue = props.testInput ?? '';
  let testResults: TestResult[] = [];
  const disposers: (() => void)[] = [];

  function send(event: GuardrailConfigEvent) {
    state = guardrailConfigReducer(state, event);
    update();
  }

  const root = new StackLayout();
  root.className = 'guardrail-config';
  root.automationText = `Guardrail config: ${props.name}`;

  const header = new StackLayout();
  header.orientation = 'horizontal';

  const nameLabel = new Label();
  nameLabel.text = props.name;
  nameLabel.fontWeight = 'bold';
  header.addChild(nameLabel);

  const typeBadge = new Label();
  typeBadge.text = props.guardrailType;
  typeBadge.marginLeft = 8;
  header.addChild(typeBadge);
  root.addChild(header);

  const ruleScroll = new ScrollView();
  const ruleList = new StackLayout();
  ruleScroll.content = ruleList;
  root.addChild(ruleScroll);

  const addBtn = new Button();
  addBtn.text = 'Add Rule';
  const addTapCb = () => {
    send({ type: 'ADD_RULE' });
    props.onAddRule?.();
  };
  addBtn.on('tap', addTapCb);
  disposers.push(() => addBtn.off('tap', addTapCb));
  root.addChild(addBtn);

  const testArea = new StackLayout();
  testArea.marginTop = 12;

  const testInput = new TextView();
  testInput.hint = 'Enter test input...';
  testInput.text = testValue;
  testInput.on('textChange', () => {
    testValue = testInput.text;
  });
  testArea.addChild(testInput);

  const testBtn = new Button();
  testBtn.text = 'Test';
  const testTapCb = async () => {
    if (!testValue.trim()) return;
    send({ type: 'TEST' });
    try {
      const result = await props.onTest?.(testValue);
      if (Array.isArray(result)) {
        testResults = result;
      }
    } finally {
      send({ type: 'TEST_COMPLETE' });
    }
  };
  testBtn.on('tap', testTapCb);
  disposers.push(() => testBtn.off('tap', testTapCb));
  testArea.addChild(testBtn);

  const testResultContainer = new StackLayout();
  testArea.addChild(testResultContainer);
  root.addChild(testArea);

  function update() {
    testArea.visibility = props.showTest !== false ? 'visible' : 'collapsed';
    testBtn.isEnabled = state !== 'testing';
    testBtn.text = state === 'testing' ? 'Testing...' : 'Test';

    ruleList.removeChildren();
    for (const rule of props.rules) {
      const item = new StackLayout();
      item.padding = 8;
      item.marginBottom = 4;
      item.borderWidth = selectedRuleId === rule.id ? 2 : 1;
      item.borderColor = selectedRuleId === rule.id ? '#3b82f6' : '#e5e7eb';
      item.borderRadius = 6;

      const topRow = new StackLayout();
      topRow.orientation = 'horizontal';

      const toggle = new Switch();
      toggle.checked = rule.enabled;
      toggle.on('checkedChange', () => {
        props.onRuleToggle?.(rule.id, !rule.enabled);
      });
      topRow.addChild(toggle);

      const ruleName = new Label();
      ruleName.text = rule.name;
      ruleName.fontWeight = 'bold';
      ruleName.marginLeft = 8;
      topRow.addChild(ruleName);

      const ruleType = new Label();
      ruleType.text = rule.type;
      ruleType.marginLeft = 8;
      ruleType.fontSize = 12;
      topRow.addChild(ruleType);

      item.addChild(topRow);

      const desc = new Label();
      desc.text = rule.description;
      desc.textWrap = true;
      desc.fontSize = 13;
      desc.marginTop = 4;
      item.addChild(desc);

      const sevRow = new StackLayout();
      sevRow.orientation = 'horizontal';
      sevRow.marginTop = 4;
      for (const sev of SEVERITY_OPTIONS) {
        const sevBtn = new Button();
        sevBtn.text = sev;
        sevBtn.className = rule.severity === sev ? 'severity-active' : 'severity-option';
        sevBtn.on('tap', () => {
          props.onSeverityChange?.(rule.id, sev);
        });
        sevRow.addChild(sevBtn);
      }
      item.addChild(sevRow);

      item.on('tap', () => {
        selectedRuleId = rule.id;
        send({ type: 'SELECT_RULE', id: rule.id });
      });

      ruleList.addChild(item);
    }

    testResultContainer.removeChildren();
    if (testResults.length > 0) {
      const triggered = testResults.filter((r) => r.triggered);
      const summary = new Label();
      summary.text =
        triggered.length === 0
          ? 'All rules passed'
          : `${triggered.length} rule${triggered.length === 1 ? '' : 's'} triggered`;
      summary.fontWeight = 'bold';
      testResultContainer.addChild(summary);

      for (const result of testResults) {
        const row = new StackLayout();
        row.orientation = 'horizontal';
        row.marginTop = 2;

        const rName = new Label();
        rName.text = result.ruleName;
        row.addChild(rName);

        const rStatus = new Label();
        rStatus.text = result.triggered ? result.severity : 'pass';
        rStatus.marginLeft = 8;
        row.addChild(rStatus);

        testResultContainer.addChild(row);
      }
    }
  }

  update();

  return {
    view: root,
    dispose() {
      disposers.forEach((d) => d());
    },
  };
}

export default createGuardrailConfig;
