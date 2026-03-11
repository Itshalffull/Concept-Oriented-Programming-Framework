// ============================================================
// Clef Surface NativeScript Widget — ConditionBuilder
//
// Visual condition/rule builder with AND/OR logic.
// ============================================================

import { StackLayout, Label, Button } from '@nativescript/core';

export interface ConditionRow { id: string; field: string; operator: string; value: string; }
export interface FieldDef { name: string; label: string; type: string; }

export interface ConditionBuilderProps {
  conditions?: ConditionRow[];
  fields?: FieldDef[];
  logic?: 'and' | 'or';
  readOnly?: boolean;
  onAdd?: () => void;
  onRemove?: (id: string) => void;
  onChange?: (conditions: ConditionRow[]) => void;
}

export function createConditionBuilder(props: ConditionBuilderProps): StackLayout {
  const { conditions = [], fields = [], logic = 'and', readOnly = false, onAdd, onRemove, onChange } = props;
  const container = new StackLayout();
  container.className = 'clef-widget-condition-builder';
  container.accessibilityLabel = 'Condition builder';

  for (let i = 0; i < conditions.length; i++) {
    if (i > 0) {
      const logicLabel = new Label();
      logicLabel.text = logic.toUpperCase();
      logicLabel.horizontalAlignment = 'center';
      logicLabel.opacity = 0.5;
      container.addChild(logicLabel);
    }
    const row = new StackLayout();
    row.orientation = 'horizontal';
    row.padding = '4';
    const fieldLabel = new Label();
    fieldLabel.text = `${conditions[i].field} ${conditions[i].operator} ${conditions[i].value}`;
    row.addChild(fieldLabel);
    if (!readOnly) {
      const removeBtn = new Button();
      removeBtn.text = '\u2715';
      removeBtn.on('tap', () => onRemove?.(conditions[i].id));
      row.addChild(removeBtn);
    }
    container.addChild(row);
  }

  if (!readOnly) {
    const addBtn = new Button();
    addBtn.text = '+ Add Condition';
    addBtn.on('tap', () => onAdd?.());
    container.addChild(addBtn);
  }
  return container;
}

export default createConditionBuilder;
