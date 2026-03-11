// ============================================================
// Clef Surface NativeScript Widget — AutomationBuilder
//
// Visual automation/workflow step builder with conditions.
// ============================================================

import { StackLayout, Label, Button } from '@nativescript/core';

export interface AutomationStep { id: string; type: string; title: string; config?: Record<string, unknown>; }

export interface AutomationBuilderProps {
  steps?: AutomationStep[];
  trigger?: string;
  readOnly?: boolean;
  onAddStep?: () => void;
  onRemoveStep?: (id: string) => void;
  onReorderSteps?: (ids: string[]) => void;
  onEditStep?: (id: string) => void;
}

export function createAutomationBuilder(props: AutomationBuilderProps): StackLayout {
  const { steps = [], trigger, readOnly = false, onAddStep, onRemoveStep, onEditStep } = props;
  const container = new StackLayout();
  container.className = 'clef-widget-automation-builder';
  container.accessibilityLabel = 'Automation builder';

  if (trigger) {
    const triggerLabel = new Label();
    triggerLabel.text = `Trigger: ${trigger}`;
    triggerLabel.fontWeight = 'bold';
    container.addChild(triggerLabel);
  }

  for (const step of steps) {
    const stepRow = new StackLayout();
    stepRow.orientation = 'horizontal';
    stepRow.padding = '8';
    stepRow.className = 'clef-automation-step';
    const stepLabel = new Label();
    stepLabel.text = step.title;
    stepRow.addChild(stepLabel);
    if (!readOnly) {
      const editBtn = new Button();
      editBtn.text = '\u270E';
      editBtn.on('tap', () => onEditStep?.(step.id));
      stepRow.addChild(editBtn);
      const removeBtn = new Button();
      removeBtn.text = '\u2715';
      removeBtn.on('tap', () => onRemoveStep?.(step.id));
      stepRow.addChild(removeBtn);
    }
    container.addChild(stepRow);
  }

  if (!readOnly) {
    const addBtn = new Button();
    addBtn.text = '+ Add Step';
    addBtn.on('tap', () => onAddStep?.());
    container.addChild(addBtn);
  }
  return container;
}

export default createAutomationBuilder;
