// ============================================================
// Clef Surface NativeScript Widget — SortBuilder
//
// Visual sort rule construction widget. Allows users to add,
// remove, and reorder sort criteria with field name and
// ascending/descending direction toggles.
// See Architecture doc Section 16.
// ============================================================

import { StackLayout, GridLayout, Label, Button, ScrollView } from '@nativescript/core';

// --------------- Types ---------------

export type SortDirection = 'asc' | 'desc';

export interface SortRule {
  id: string;
  field: string;
  direction: SortDirection;
}

export interface SortableField {
  name: string;
  label: string;
}

// --------------- Props ---------------

export interface SortBuilderProps {
  /** Current sort rules in priority order. */
  rules?: SortRule[];
  /** Available fields for sorting. */
  fields?: SortableField[];
  /** Called when a new sort rule is added. */
  onAddRule?: () => void;
  /** Called when a sort rule is removed. */
  onRemoveRule?: (ruleId: string) => void;
  /** Called when direction is toggled. */
  onToggleDirection?: (ruleId: string, direction: SortDirection) => void;
  /** Called when a rule is moved up in priority. */
  onMoveUp?: (ruleId: string) => void;
  /** Called when a rule is moved down in priority. */
  onMoveDown?: (ruleId: string) => void;
}

// --------------- Component ---------------

export function createSortBuilder(props: SortBuilderProps = {}): StackLayout {
  const {
    rules = [],
    fields = [],
    onAddRule,
    onRemoveRule,
    onToggleDirection,
    onMoveUp,
    onMoveDown,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-widget-sort-builder';
  container.padding = 12;

  // Header
  const header = new GridLayout();
  header.columns = '*, auto';
  header.marginBottom = 8;

  const titleLabel = new Label();
  titleLabel.text = 'Sort Order';
  titleLabel.fontWeight = 'bold';
  titleLabel.fontSize = 16;
  GridLayout.setColumn(titleLabel, 0);
  header.addChild(titleLabel);

  if (onAddRule) {
    const addBtn = new Button();
    addBtn.text = '+ Add';
    addBtn.fontSize = 11;
    addBtn.padding = 4;
    GridLayout.setColumn(addBtn, 1);
    addBtn.on('tap', () => onAddRule());
    header.addChild(addBtn);
  }

  container.addChild(header);

  // Empty state
  if (rules.length === 0) {
    const emptyLabel = new Label();
    emptyLabel.text = 'No sort rules defined. Tap "+ Add" to create one.';
    emptyLabel.opacity = 0.5;
    emptyLabel.horizontalAlignment = 'center';
    emptyLabel.marginTop = 16;
    container.addChild(emptyLabel);
    return container;
  }

  // Sort rule list
  const scrollView = new ScrollView();
  const list = new StackLayout();

  rules.forEach((rule, index) => {
    const row = new GridLayout();
    row.columns = 'auto, auto, *, auto, auto';
    row.padding = 8;
    row.marginBottom = 4;
    row.borderRadius = 4;
    row.backgroundColor = '#F5F5F5' as any;

    // Priority number
    const priorityLabel = new Label();
    priorityLabel.text = `${index + 1}.`;
    priorityLabel.fontSize = 12;
    priorityLabel.fontWeight = 'bold';
    priorityLabel.opacity = 0.5;
    priorityLabel.verticalAlignment = 'middle';
    priorityLabel.marginRight = 8;
    GridLayout.setColumn(priorityLabel, 0);
    row.addChild(priorityLabel);

    // Move buttons
    const moveStack = new StackLayout();
    moveStack.verticalAlignment = 'middle';
    moveStack.marginRight = 8;
    GridLayout.setColumn(moveStack, 1);

    if (onMoveUp && index > 0) {
      const upBtn = new Button();
      upBtn.text = '\u25B2';
      upBtn.fontSize = 9;
      upBtn.padding = 1;
      upBtn.on('tap', () => onMoveUp(rule.id));
      moveStack.addChild(upBtn);
    }

    if (onMoveDown && index < rules.length - 1) {
      const downBtn = new Button();
      downBtn.text = '\u25BC';
      downBtn.fontSize = 9;
      downBtn.padding = 1;
      downBtn.on('tap', () => onMoveDown(rule.id));
      moveStack.addChild(downBtn);
    }

    row.addChild(moveStack);

    // Field name
    const fieldLabel = new Label();
    const matchedField = fields.find((f) => f.name === rule.field);
    fieldLabel.text = matchedField?.label || rule.field;
    fieldLabel.fontSize = 13;
    fieldLabel.fontWeight = 'bold';
    fieldLabel.verticalAlignment = 'middle';
    GridLayout.setColumn(fieldLabel, 2);
    row.addChild(fieldLabel);

    // Direction toggle
    const dirBtn = new Button();
    dirBtn.text = rule.direction === 'asc' ? '\u2191 ASC' : '\u2193 DESC';
    dirBtn.fontSize = 11;
    dirBtn.padding = 4;
    dirBtn.verticalAlignment = 'middle';
    dirBtn.marginRight = 4;
    GridLayout.setColumn(dirBtn, 3);
    if (onToggleDirection) {
      dirBtn.on('tap', () => {
        onToggleDirection(rule.id, rule.direction === 'asc' ? 'desc' : 'asc');
      });
    }
    row.addChild(dirBtn);

    // Remove button
    if (onRemoveRule) {
      const removeBtn = new Button();
      removeBtn.text = '\u2715';
      removeBtn.fontSize = 12;
      removeBtn.padding = 2;
      removeBtn.verticalAlignment = 'middle';
      GridLayout.setColumn(removeBtn, 4);
      removeBtn.on('tap', () => onRemoveRule(rule.id));
      row.addChild(removeBtn);
    }

    list.addChild(row);
  });

  scrollView.content = list;
  container.addChild(scrollView);
  return container;
}

createSortBuilder.displayName = 'SortBuilder';
export default createSortBuilder;
