// ============================================================
// Clef Surface NativeScript Widget — ConditionBuilder
//
// Visual condition/logic builder. Renders a list of condition
// rows with field, operator, and value selectors, grouped by
// AND/OR logic. Supports adding, removing, and nesting groups.
// ============================================================

import {
  StackLayout,
  GridLayout,
  Label,
  TextField,
  Button,
  Color,
  GestureTypes,
} from '@nativescript/core';

// --------------- Types ---------------

export interface FieldDef {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'enum';
  options?: string[];
}

export interface ConditionRow {
  field: string;
  operator: string;
  value: string;
}

export interface ConditionGroup {
  logic: 'and' | 'or';
  conditions: Array<ConditionRow | ConditionGroup>;
}

export interface ConditionBuilderProps {
  fields?: FieldDef[];
  conditions?: ConditionRow[];
  groups?: ConditionGroup[];
  logic?: 'and' | 'or';
  readOnly?: boolean;
  maxDepth?: number;
  accentColor?: string;
  onConditionsChange?: (conditions: ConditionRow[]) => void;
  onConditionAdd?: () => void;
  onConditionRemove?: (index: number) => void;
  onConditionChange?: (index: number, condition: ConditionRow) => void;
  onLogicChange?: (logic: 'and' | 'or') => void;
  onGroupAdd?: () => void;
}

// --------------- Helpers ---------------

const OPERATORS: Record<string, string[]> = {
  string: ['equals', 'not equals', 'contains', 'starts with', 'ends with', 'matches', 'is empty'],
  number: ['equals', 'not equals', 'greater than', 'less than', 'between', 'is empty'],
  boolean: ['is true', 'is false'],
  date: ['equals', 'before', 'after', 'between', 'is empty'],
  enum: ['equals', 'not equals', 'in', 'not in'],
};

const LOGIC_COLORS: Record<string, string> = {
  and: '#3b82f6',
  or: '#f97316',
};

// --------------- Component ---------------

export function createConditionBuilder(props: ConditionBuilderProps = {}): StackLayout {
  const {
    fields = [],
    conditions = [],
    logic = 'and',
    readOnly = false,
    maxDepth = 3,
    accentColor = '#06b6d4',
    onConditionsChange,
    onConditionAdd,
    onConditionRemove,
    onConditionChange,
    onLogicChange,
    onGroupAdd,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-condition-builder';
  container.padding = 8;
  container.borderWidth = 1;
  container.borderColor = new Color('#333333');
  container.borderRadius = 6;

  // Header with logic toggle
  const header = new GridLayout();
  header.columns = 'auto, *, auto';
  header.marginBottom = 8;

  const headerLabel = new Label();
  headerLabel.text = 'Conditions';
  headerLabel.fontWeight = 'bold';
  headerLabel.fontSize = 14;
  headerLabel.color = new Color(accentColor);
  GridLayout.setColumn(headerLabel, 0);
  header.addChild(headerLabel);

  // Logic toggle
  if (!readOnly) {
    const logicRow = new StackLayout();
    logicRow.orientation = 'horizontal';
    logicRow.horizontalAlignment = 'right';

    const andBtn = new Button();
    andBtn.text = 'AND';
    andBtn.fontSize = 10;
    andBtn.marginRight = 4;
    andBtn.borderRadius = 3;
    if (logic === 'and') {
      andBtn.backgroundColor = new Color(LOGIC_COLORS.and);
      andBtn.color = new Color('#ffffff');
    }
    andBtn.on('tap', () => onLogicChange?.('and'));
    logicRow.addChild(andBtn);

    const orBtn = new Button();
    orBtn.text = 'OR';
    orBtn.fontSize = 10;
    orBtn.borderRadius = 3;
    if (logic === 'or') {
      orBtn.backgroundColor = new Color(LOGIC_COLORS.or);
      orBtn.color = new Color('#ffffff');
    }
    orBtn.on('tap', () => onLogicChange?.('or'));
    logicRow.addChild(orBtn);

    GridLayout.setColumn(logicRow, 2);
    header.addChild(logicRow);
  }

  container.addChild(header);

  // Condition rows
  conditions.forEach((condition, index) => {
    // Logic separator between rows
    if (index > 0) {
      const logicLabel = new Label();
      logicLabel.text = logic.toUpperCase();
      logicLabel.fontSize = 10;
      logicLabel.fontWeight = 'bold';
      logicLabel.color = new Color(LOGIC_COLORS[logic] || accentColor);
      logicLabel.horizontalAlignment = 'center';
      logicLabel.marginTop = 2;
      logicLabel.marginBottom = 2;
      container.addChild(logicLabel);
    }

    const row = new GridLayout();
    row.columns = '*, auto, *, auto';
    row.padding = 6;
    row.backgroundColor = new Color('#1a1a2e');
    row.borderRadius = 4;
    row.marginBottom = 2;

    // Field name
    const fieldLabel = new Label();
    fieldLabel.text = condition.field || 'Select field...';
    fieldLabel.color = new Color(condition.field ? '#e0e0e0' : '#666666');
    fieldLabel.fontSize = 12;
    fieldLabel.verticalAlignment = 'middle';
    GridLayout.setColumn(fieldLabel, 0);
    row.addChild(fieldLabel);

    // Operator
    const opLabel = new Label();
    opLabel.text = condition.operator || 'operator';
    opLabel.fontSize = 11;
    opLabel.color = new Color(accentColor);
    opLabel.marginLeft = 4;
    opLabel.marginRight = 4;
    opLabel.verticalAlignment = 'middle';
    GridLayout.setColumn(opLabel, 1);
    row.addChild(opLabel);

    // Value
    if (readOnly) {
      const valueLabel = new Label();
      valueLabel.text = condition.value || '';
      valueLabel.color = new Color('#e0e0e0');
      valueLabel.fontSize = 12;
      valueLabel.verticalAlignment = 'middle';
      GridLayout.setColumn(valueLabel, 2);
      row.addChild(valueLabel);
    } else {
      const valueField = new TextField();
      valueField.text = condition.value || '';
      valueField.hint = 'value';
      valueField.fontSize = 12;
      valueField.color = new Color('#e0e0e0');
      valueField.backgroundColor = new Color('#0d0d1a');
      valueField.borderRadius = 3;
      valueField.on('textChange', (args: any) => {
        onConditionChange?.(index, { ...condition, value: args.object.text });
      });
      GridLayout.setColumn(valueField, 2);
      row.addChild(valueField);
    }

    // Remove button
    if (!readOnly) {
      const removeBtn = new Button();
      removeBtn.text = '\u2716';
      removeBtn.fontSize = 10;
      removeBtn.width = 24;
      removeBtn.height = 24;
      removeBtn.on('tap', () => onConditionRemove?.(index));
      GridLayout.setColumn(removeBtn, 3);
      row.addChild(removeBtn);
    }

    container.addChild(row);
  });

  // Empty state
  if (conditions.length === 0) {
    const emptyLabel = new Label();
    emptyLabel.text = 'No conditions set. All items will match.';
    emptyLabel.opacity = 0.4;
    emptyLabel.horizontalAlignment = 'center';
    emptyLabel.marginTop = 8;
    emptyLabel.marginBottom = 8;
    container.addChild(emptyLabel);
  }

  // Add buttons
  if (!readOnly) {
    const actionsRow = new StackLayout();
    actionsRow.orientation = 'horizontal';
    actionsRow.marginTop = 8;

    const addBtn = new Button();
    addBtn.text = '+ Add Condition';
    addBtn.fontSize = 12;
    addBtn.marginRight = 8;
    addBtn.on('tap', () => onConditionAdd?.());
    actionsRow.addChild(addBtn);

    const groupBtn = new Button();
    groupBtn.text = '+ Add Group';
    groupBtn.fontSize = 12;
    groupBtn.on('tap', () => onGroupAdd?.());
    actionsRow.addChild(groupBtn);

    container.addChild(actionsRow);
  }

  // Available fields summary
  if (fields.length > 0) {
    const fieldSummary = new Label();
    fieldSummary.text = `Available fields: ${fields.map((f) => f.name).join(', ')}`;
    fieldSummary.fontSize = 10;
    fieldSummary.opacity = 0.3;
    fieldSummary.textWrap = true;
    fieldSummary.marginTop = 8;
    container.addChild(fieldSummary);
  }

  return container;
}

export default createConditionBuilder;
