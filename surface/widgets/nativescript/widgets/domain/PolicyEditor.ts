// ============================================================
// Clef Surface NativeScript Widget — PolicyEditor
//
// Policy rule editing. Renders a list of policy rules with
// effect (allow/deny), subject, action, and resource fields.
// Supports adding, removing, reordering, and validating rules.
// ============================================================

import {
  StackLayout,
  GridLayout,
  Label,
  TextField,
  Button,
  ScrollView,
  Color,
  GestureTypes,
} from '@nativescript/core';

// --------------- Types ---------------

export interface PolicyRule {
  id: string;
  effect: 'allow' | 'deny';
  subject: string;
  action: string;
  resource: string;
  conditions?: string[];
  priority?: number;
}

export interface ServiceDef {
  name: string;
  actions: string[];
  resources: string[];
}

export interface ValidationError {
  ruleId: string;
  field: string;
  message: string;
}

export interface PolicyEditorProps {
  rules?: PolicyRule[];
  services?: ServiceDef[];
  validationErrors?: ValidationError[];
  readOnly?: boolean;
  selectedRuleId?: string;
  policyName?: string;
  accentColor?: string;
  onRuleAdd?: () => void;
  onRuleRemove?: (id: string) => void;
  onRuleChange?: (id: string, rule: PolicyRule) => void;
  onRuleSelect?: (id: string) => void;
  onRuleReorder?: (id: string, direction: 'up' | 'down') => void;
  onValidate?: () => void;
}

// --------------- Helpers ---------------

const EFFECT_COLORS: Record<string, string> = {
  allow: '#22c55e',
  deny: '#ef4444',
};

const EFFECT_ICONS: Record<string, string> = {
  allow: '\u2714',
  deny: '\u2716',
};

// --------------- Component ---------------

export function createPolicyEditor(props: PolicyEditorProps = {}): StackLayout {
  const {
    rules = [],
    services = [],
    validationErrors = [],
    readOnly = false,
    selectedRuleId,
    policyName = 'Policy',
    accentColor = '#06b6d4',
    onRuleAdd,
    onRuleRemove,
    onRuleChange,
    onRuleSelect,
    onRuleReorder,
    onValidate,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-policy-editor';
  container.padding = 8;

  // Header
  const header = new GridLayout();
  header.columns = '*, auto, auto';
  header.marginBottom = 8;

  const titleStack = new StackLayout();
  const titleLabel = new Label();
  titleLabel.text = `\uD83D\uDEE1 ${policyName}`;
  titleLabel.fontWeight = 'bold';
  titleLabel.fontSize = 14;
  titleLabel.color = new Color(accentColor);
  titleStack.addChild(titleLabel);

  const ruleCount = new Label();
  ruleCount.text = `${rules.length} rules`;
  ruleCount.fontSize = 10;
  ruleCount.opacity = 0.5;
  titleStack.addChild(ruleCount);

  GridLayout.setColumn(titleStack, 0);
  header.addChild(titleStack);

  // Validate button
  const validateBtn = new Button();
  validateBtn.text = '\u2714 Validate';
  validateBtn.fontSize = 11;
  validateBtn.marginRight = 4;
  validateBtn.on('tap', () => onValidate?.());
  GridLayout.setColumn(validateBtn, 1);
  header.addChild(validateBtn);

  // Validation status
  if (validationErrors.length > 0) {
    const errorBadge = new Label();
    errorBadge.text = `${validationErrors.length} errors`;
    errorBadge.fontSize = 10;
    errorBadge.color = new Color('#ef4444');
    errorBadge.verticalAlignment = 'middle';
    GridLayout.setColumn(errorBadge, 2);
    header.addChild(errorBadge);
  } else if (rules.length > 0) {
    const validBadge = new Label();
    validBadge.text = '\u2714 Valid';
    validBadge.fontSize = 10;
    validBadge.color = new Color('#22c55e');
    validBadge.verticalAlignment = 'middle';
    GridLayout.setColumn(validBadge, 2);
    header.addChild(validBadge);
  }

  container.addChild(header);

  // Rules list
  const scrollView = new ScrollView();
  const rulesList = new StackLayout();

  rules.forEach((rule, index) => {
    const isSelected = rule.id === selectedRuleId;
    const ruleErrors = validationErrors.filter((e) => e.ruleId === rule.id);

    const card = new GridLayout();
    card.columns = 'auto, auto, *, auto';
    card.padding = 8;
    card.marginBottom = 4;
    card.borderRadius = 6;
    card.borderWidth = isSelected ? 2 : 1;
    card.borderColor = new Color(
      ruleErrors.length > 0 ? '#ef4444' : isSelected ? accentColor : '#333333'
    );
    card.backgroundColor = new Color(isSelected ? '#1a2a3a' : '#1a1a2e');

    // Priority / order
    const priorityLabel = new Label();
    priorityLabel.text = String(rule.priority ?? index + 1);
    priorityLabel.fontSize = 10;
    priorityLabel.opacity = 0.4;
    priorityLabel.width = 20;
    priorityLabel.textAlignment = 'center';
    priorityLabel.verticalAlignment = 'middle';
    GridLayout.setColumn(priorityLabel, 0);
    card.addChild(priorityLabel);

    // Effect badge
    const effectBadge = new StackLayout();
    effectBadge.width = 60;
    effectBadge.padding = 4;
    effectBadge.borderRadius = 4;
    effectBadge.marginRight = 8;
    effectBadge.backgroundColor = new Color(EFFECT_COLORS[rule.effect] + '30');
    effectBadge.verticalAlignment = 'middle';

    const effectLabel = new Label();
    effectLabel.text = `${EFFECT_ICONS[rule.effect]} ${rule.effect.toUpperCase()}`;
    effectLabel.fontSize = 10;
    effectLabel.fontWeight = 'bold';
    effectLabel.color = new Color(EFFECT_COLORS[rule.effect]);
    effectLabel.horizontalAlignment = 'center';
    effectBadge.addChild(effectLabel);

    GridLayout.setColumn(effectBadge, 1);
    card.addChild(effectBadge);

    // Rule details
    const detailStack = new StackLayout();

    const subjectRow = new StackLayout();
    subjectRow.orientation = 'horizontal';

    const subjectKeyLabel = new Label();
    subjectKeyLabel.text = 'Subject: ';
    subjectKeyLabel.fontSize = 11;
    subjectKeyLabel.opacity = 0.5;
    subjectRow.addChild(subjectKeyLabel);

    const subjectValLabel = new Label();
    subjectValLabel.text = rule.subject || '*';
    subjectValLabel.fontSize = 11;
    subjectValLabel.color = new Color('#e0e0e0');
    subjectRow.addChild(subjectValLabel);

    detailStack.addChild(subjectRow);

    const actionRow = new StackLayout();
    actionRow.orientation = 'horizontal';

    const actionKeyLabel = new Label();
    actionKeyLabel.text = 'Action: ';
    actionKeyLabel.fontSize = 11;
    actionKeyLabel.opacity = 0.5;
    actionRow.addChild(actionKeyLabel);

    const actionValLabel = new Label();
    actionValLabel.text = rule.action || '*';
    actionValLabel.fontSize = 11;
    actionValLabel.color = new Color(accentColor);
    actionRow.addChild(actionValLabel);

    detailStack.addChild(actionRow);

    const resourceRow = new StackLayout();
    resourceRow.orientation = 'horizontal';

    const resourceKeyLabel = new Label();
    resourceKeyLabel.text = 'Resource: ';
    resourceKeyLabel.fontSize = 11;
    resourceKeyLabel.opacity = 0.5;
    resourceRow.addChild(resourceKeyLabel);

    const resourceValLabel = new Label();
    resourceValLabel.text = rule.resource || '*';
    resourceValLabel.fontSize = 11;
    resourceValLabel.color = new Color('#e0e0e0');
    resourceRow.addChild(resourceValLabel);

    detailStack.addChild(resourceRow);

    // Conditions
    if (rule.conditions && rule.conditions.length > 0) {
      const condLabel = new Label();
      condLabel.text = `Conditions: ${rule.conditions.join(', ')}`;
      condLabel.fontSize = 10;
      condLabel.opacity = 0.4;
      condLabel.textWrap = true;
      detailStack.addChild(condLabel);
    }

    // Validation errors for this rule
    ruleErrors.forEach((err) => {
      const errLabel = new Label();
      errLabel.text = `\u2716 ${err.field}: ${err.message}`;
      errLabel.fontSize = 10;
      errLabel.color = new Color('#ef4444');
      detailStack.addChild(errLabel);
    });

    GridLayout.setColumn(detailStack, 2);
    card.addChild(detailStack);

    // Actions
    if (!readOnly) {
      const actionsStack = new StackLayout();
      actionsStack.verticalAlignment = 'middle';

      const reorderUpBtn = new Button();
      reorderUpBtn.text = '\u25B2';
      reorderUpBtn.fontSize = 9;
      reorderUpBtn.width = 24;
      reorderUpBtn.height = 20;
      reorderUpBtn.isEnabled = index > 0;
      reorderUpBtn.on('tap', () => onRuleReorder?.(rule.id, 'up'));
      actionsStack.addChild(reorderUpBtn);

      const reorderDownBtn = new Button();
      reorderDownBtn.text = '\u25BC';
      reorderDownBtn.fontSize = 9;
      reorderDownBtn.width = 24;
      reorderDownBtn.height = 20;
      reorderDownBtn.isEnabled = index < rules.length - 1;
      reorderDownBtn.on('tap', () => onRuleReorder?.(rule.id, 'down'));
      actionsStack.addChild(reorderDownBtn);

      const deleteBtn = new Button();
      deleteBtn.text = '\u2716';
      deleteBtn.fontSize = 9;
      deleteBtn.width = 24;
      deleteBtn.height = 20;
      deleteBtn.on('tap', () => onRuleRemove?.(rule.id));
      actionsStack.addChild(deleteBtn);

      GridLayout.setColumn(actionsStack, 3);
      card.addChild(actionsStack);
    }

    card.on(GestureTypes.tap as any, () => onRuleSelect?.(rule.id));
    rulesList.addChild(card);
  });

  // Empty state
  if (rules.length === 0) {
    const emptyLabel = new Label();
    emptyLabel.text = 'No rules defined. Default policy applies.';
    emptyLabel.opacity = 0.4;
    emptyLabel.horizontalAlignment = 'center';
    emptyLabel.marginTop = 20;
    rulesList.addChild(emptyLabel);
  }

  // Add rule button
  if (!readOnly) {
    const addBtn = new Button();
    addBtn.text = '+ Add Rule';
    addBtn.fontSize = 12;
    addBtn.horizontalAlignment = 'center';
    addBtn.marginTop = 8;
    addBtn.on('tap', () => onRuleAdd?.());
    rulesList.addChild(addBtn);
  }

  scrollView.content = rulesList;
  container.addChild(scrollView);

  return container;
}

export default createPolicyEditor;
