// ============================================================
// Clef Surface NativeScript Widget — FilterBuilder
//
// Visual filter rule construction widget. Allows users to add,
// remove, and configure filter rules with field, operator, and
// value selection. Supports AND/OR group logic.
// See Architecture doc Section 16.
// ============================================================

import { StackLayout, GridLayout, Label, TextField, Button, ScrollView } from '@nativescript/core';

// --------------- Types ---------------

export type FilterOperator = 'equals' | 'not_equals' | 'contains' | 'starts_with' | 'ends_with' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'not_in';

export interface FilterRule {
  id: string;
  field: string;
  operator: FilterOperator;
  value: string;
}

export type FilterLogic = 'and' | 'or';

export interface FilterField {
  name: string;
  label: string;
  operators?: FilterOperator[];
}

// --------------- Props ---------------

export interface FilterBuilderProps {
  /** Current filter rules. */
  rules?: FilterRule[];
  /** Logical connector between rules. */
  logic?: FilterLogic;
  /** Available fields for filtering. */
  fields?: FilterField[];
  /** Called when a rule is added. */
  onAddRule?: () => void;
  /** Called when a rule is removed. */
  onRemoveRule?: (ruleId: string) => void;
  /** Called when a rule is modified. */
  onUpdateRule?: (ruleId: string, field: string, operator: FilterOperator, value: string) => void;
  /** Called when logic connector changes. */
  onLogicChange?: (logic: FilterLogic) => void;
}

// --------------- Helpers ---------------

const OPERATOR_LABELS: Record<FilterOperator, string> = {
  equals: '=',
  not_equals: '\u2260',
  contains: 'contains',
  starts_with: 'starts with',
  ends_with: 'ends with',
  gt: '>',
  lt: '<',
  gte: '\u2265',
  lte: '\u2264',
  in: 'in',
  not_in: 'not in',
};

// --------------- Component ---------------

export function createFilterBuilder(props: FilterBuilderProps = {}): StackLayout {
  const {
    rules = [],
    logic = 'and',
    fields = [],
    onAddRule,
    onRemoveRule,
    onUpdateRule,
    onLogicChange,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-widget-filter-builder';
  container.padding = 12;

  // Header
  const header = new GridLayout();
  header.columns = '*, auto, auto';
  header.marginBottom = 8;

  const titleLabel = new Label();
  titleLabel.text = 'Filters';
  titleLabel.fontWeight = 'bold';
  titleLabel.fontSize = 16;
  GridLayout.setColumn(titleLabel, 0);
  header.addChild(titleLabel);

  // Logic toggle
  const logicBtn = new Button();
  logicBtn.text = logic.toUpperCase();
  logicBtn.fontSize = 11;
  logicBtn.padding = 4;
  logicBtn.marginRight = 4;
  GridLayout.setColumn(logicBtn, 1);
  if (onLogicChange) {
    logicBtn.on('tap', () => onLogicChange(logic === 'and' ? 'or' : 'and'));
  }
  header.addChild(logicBtn);

  // Add rule button
  const addBtn = new Button();
  addBtn.text = '+ Add';
  addBtn.fontSize = 11;
  addBtn.padding = 4;
  GridLayout.setColumn(addBtn, 2);
  if (onAddRule) {
    addBtn.on('tap', () => onAddRule());
  }
  header.addChild(addBtn);

  container.addChild(header);

  // Empty state
  if (rules.length === 0) {
    const emptyLabel = new Label();
    emptyLabel.text = 'No filter rules. Tap "+ Add" to create one.';
    emptyLabel.opacity = 0.5;
    emptyLabel.horizontalAlignment = 'center';
    emptyLabel.marginTop = 16;
    container.addChild(emptyLabel);
    return container;
  }

  // Rule list
  const scrollView = new ScrollView();
  const list = new StackLayout();

  rules.forEach((rule, index) => {
    if (index > 0) {
      const connectorLabel = new Label();
      connectorLabel.text = logic.toUpperCase();
      connectorLabel.horizontalAlignment = 'center';
      connectorLabel.opacity = 0.4;
      connectorLabel.fontSize = 11;
      connectorLabel.margin = 4;
      list.addChild(connectorLabel);
    }

    const ruleRow = new GridLayout();
    ruleRow.columns = '*, auto, *, auto';
    ruleRow.padding = 8;
    ruleRow.marginBottom = 2;
    ruleRow.borderRadius = 4;
    ruleRow.backgroundColor = '#F5F5F5' as any;

    // Field label
    const fieldLabel = new Label();
    fieldLabel.text = rule.field || '(field)';
    fieldLabel.fontSize = 12;
    fieldLabel.fontWeight = 'bold';
    fieldLabel.verticalAlignment = 'middle';
    GridLayout.setColumn(fieldLabel, 0);
    ruleRow.addChild(fieldLabel);

    // Operator label
    const opLabel = new Label();
    opLabel.text = OPERATOR_LABELS[rule.operator] || rule.operator;
    opLabel.fontSize = 12;
    opLabel.opacity = 0.6;
    opLabel.verticalAlignment = 'middle';
    opLabel.horizontalAlignment = 'center';
    opLabel.marginLeft = 4;
    opLabel.marginRight = 4;
    GridLayout.setColumn(opLabel, 1);
    ruleRow.addChild(opLabel);

    // Value field
    const valueField = new TextField();
    valueField.text = rule.value;
    valueField.hint = 'value';
    valueField.fontSize = 12;
    GridLayout.setColumn(valueField, 2);
    if (onUpdateRule) {
      valueField.on('textChange', () => {
        onUpdateRule(rule.id, rule.field, rule.operator, valueField.text);
      });
    }
    ruleRow.addChild(valueField);

    // Remove button
    const removeBtn = new Button();
    removeBtn.text = '\u2715';
    removeBtn.fontSize = 12;
    removeBtn.padding = 2;
    GridLayout.setColumn(removeBtn, 3);
    if (onRemoveRule) {
      removeBtn.on('tap', () => onRemoveRule(rule.id));
    }
    ruleRow.addChild(removeBtn);

    list.addChild(ruleRow);
  });

  scrollView.content = list;
  container.addChild(scrollView);
  return container;
}

createFilterBuilder.displayName = 'FilterBuilder';
export default createFilterBuilder;
