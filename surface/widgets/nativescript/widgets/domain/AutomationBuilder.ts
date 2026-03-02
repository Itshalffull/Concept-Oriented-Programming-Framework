// ============================================================
// Clef Surface NativeScript Widget — AutomationBuilder
//
// Visual automation rule builder. Renders a list of automation
// steps with connectors, add/delete controls, per-step config
// panels, and test result indicators.
// ============================================================

import {
  StackLayout,
  GridLayout,
  Label,
  Button,
  Color,
  ScrollView,
  GestureTypes,
} from '@nativescript/core';

// --------------- Types ---------------

export interface AutomationStep {
  type: string;
  config?: Record<string, unknown>;
  testResult?: { status: string; [k: string]: unknown };
}

export interface AutomationBuilderProps {
  steps?: AutomationStep[];
  readOnly?: boolean;
  selectedStepIndex?: number;
  testingActive?: boolean;
  branchingEnabled?: boolean;
  maxSteps?: number;
  automationName?: string;
  accentColor?: string;
  onStepsChange?: (steps: AutomationStep[]) => void;
  onStepSelect?: (index: number) => void;
  onAddStep?: (afterIndex: number) => void;
  onDeleteStep?: (index: number) => void;
  onTestAll?: () => void;
  onTestStep?: (index: number) => void;
}

// --------------- Helpers ---------------

const STEP_ICONS: Record<string, string> = {
  trigger: '\u26A1', action: '\u25B6', condition: '\u2753', delay: '\u23F1',
  webhook: '\uD83C\uDF10', email: '\u2709', transform: '\u2699',
};

const TEST_COLORS: Record<string, string> = {
  pass: '#22c55e', fail: '#ef4444', running: '#eab308', none: '#888888',
};

// --------------- Component ---------------

export function createAutomationBuilder(props: AutomationBuilderProps = {}): StackLayout {
  const {
    steps = [],
    readOnly = false,
    selectedStepIndex,
    testingActive = false,
    branchingEnabled = true,
    maxSteps = 50,
    automationName = 'Untitled Automation',
    accentColor = '#06b6d4',
    onStepsChange,
    onStepSelect,
    onAddStep,
    onDeleteStep,
    onTestAll,
    onTestStep,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-automation-builder';
  container.padding = 8;

  // Header
  const header = new GridLayout();
  header.columns = '*, auto';
  header.marginBottom = 8;

  const titleLabel = new Label();
  titleLabel.text = automationName;
  titleLabel.fontWeight = 'bold';
  titleLabel.fontSize = 16;
  titleLabel.color = new Color(accentColor);
  GridLayout.setColumn(titleLabel, 0);
  header.addChild(titleLabel);

  if (!readOnly) {
    const testAllBtn = new Button();
    testAllBtn.text = testingActive ? '\u23F3 Testing...' : '\u25B6 Test All';
    testAllBtn.fontSize = 12;
    testAllBtn.isEnabled = !testingActive;
    testAllBtn.on('tap', () => onTestAll?.());
    GridLayout.setColumn(testAllBtn, 1);
    header.addChild(testAllBtn);
  }

  container.addChild(header);

  // Step count
  const countLabel = new Label();
  countLabel.text = `${steps.length} step${steps.length !== 1 ? 's' : ''}`;
  countLabel.fontSize = 11;
  countLabel.opacity = 0.5;
  countLabel.marginBottom = 4;
  container.addChild(countLabel);

  // Scrollable step list
  const scrollView = new ScrollView();
  const stepList = new StackLayout();
  stepList.className = 'clef-automation-builder-step-list';

  steps.forEach((step, index) => {
    // Connector between steps
    if (index > 0) {
      const connector = new Label();
      connector.text = '\u2502';
      connector.horizontalAlignment = 'center';
      connector.color = new Color('#555555');
      connector.fontSize = 14;
      stepList.addChild(connector);
    }

    // Step card
    const isSelected = index === selectedStepIndex;
    const card = new GridLayout();
    card.columns = 'auto, *, auto';
    card.padding = 8;
    card.marginLeft = 12;
    card.marginRight = 12;
    card.borderRadius = 6;
    card.borderWidth = isSelected ? 2 : 1;
    card.borderColor = new Color(isSelected ? accentColor : '#444444');
    card.backgroundColor = new Color(isSelected ? '#1a2a3a' : '#1a1a2e');

    // Step icon
    const iconLabel = new Label();
    iconLabel.text = STEP_ICONS[step.type] || '\u25A0';
    iconLabel.fontSize = 18;
    iconLabel.verticalAlignment = 'middle';
    iconLabel.marginRight = 8;
    GridLayout.setColumn(iconLabel, 0);
    card.addChild(iconLabel);

    // Step info
    const infoStack = new StackLayout();

    const typeLabel = new Label();
    typeLabel.text = step.type;
    typeLabel.fontWeight = 'bold';
    typeLabel.color = new Color('#ffffff');
    infoStack.addChild(typeLabel);

    if (step.config && Object.keys(step.config).length > 0) {
      const configLabel = new Label();
      configLabel.text = Object.entries(step.config)
        .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
        .join(', ');
      configLabel.fontSize = 11;
      configLabel.opacity = 0.6;
      configLabel.textWrap = true;
      infoStack.addChild(configLabel);
    }

    // Test result
    if (step.testResult) {
      const resultLabel = new Label();
      const status = step.testResult.status;
      resultLabel.text = status === 'pass' ? '\u2714 Passed' : status === 'fail' ? '\u2716 Failed' : `\u25D4 ${status}`;
      resultLabel.color = new Color(TEST_COLORS[status] || TEST_COLORS.none);
      resultLabel.fontSize = 11;
      infoStack.addChild(resultLabel);
    }

    GridLayout.setColumn(infoStack, 1);
    card.addChild(infoStack);

    // Actions
    if (!readOnly) {
      const actionsStack = new StackLayout();
      actionsStack.orientation = 'horizontal';
      actionsStack.verticalAlignment = 'middle';

      const testBtn = new Button();
      testBtn.text = '\u25B6';
      testBtn.fontSize = 12;
      testBtn.width = 32;
      testBtn.height = 32;
      testBtn.on('tap', () => onTestStep?.(index));
      actionsStack.addChild(testBtn);

      const deleteBtn = new Button();
      deleteBtn.text = '\u2716';
      deleteBtn.fontSize = 12;
      deleteBtn.width = 32;
      deleteBtn.height = 32;
      deleteBtn.on('tap', () => onDeleteStep?.(index));
      actionsStack.addChild(deleteBtn);

      GridLayout.setColumn(actionsStack, 2);
      card.addChild(actionsStack);
    }

    card.on(GestureTypes.tap as any, () => onStepSelect?.(index));
    stepList.addChild(card);

    // Add step button after each step
    if (!readOnly && steps.length < maxSteps) {
      const addRow = new StackLayout();
      addRow.horizontalAlignment = 'center';
      addRow.marginTop = 2;
      addRow.marginBottom = 2;

      const addBtn = new Button();
      addBtn.text = '+';
      addBtn.width = 28;
      addBtn.height = 28;
      addBtn.borderRadius = 14;
      addBtn.fontSize = 16;
      addBtn.on('tap', () => onAddStep?.(index));
      addRow.addChild(addBtn);

      if (branchingEnabled) {
        const branchBtn = new Button();
        branchBtn.text = '\u2934 Branch';
        branchBtn.fontSize = 10;
        branchBtn.marginLeft = 4;
        addRow.addChild(branchBtn);
      }

      stepList.addChild(addRow);
    }
  });

  // Empty state
  if (steps.length === 0) {
    const emptyLabel = new Label();
    emptyLabel.text = 'No automation steps yet. Add a step to begin.';
    emptyLabel.opacity = 0.5;
    emptyLabel.horizontalAlignment = 'center';
    emptyLabel.marginTop = 20;
    stepList.addChild(emptyLabel);

    if (!readOnly) {
      const addFirstBtn = new Button();
      addFirstBtn.text = '+ Add First Step';
      addFirstBtn.horizontalAlignment = 'center';
      addFirstBtn.marginTop = 8;
      addFirstBtn.on('tap', () => onAddStep?.(-1));
      stepList.addChild(addFirstBtn);
    }
  }

  scrollView.content = stepList;
  container.addChild(scrollView);

  return container;
}

export default createAutomationBuilder;
