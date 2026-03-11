// ============================================================
// Clef Surface NativeScript Widget — StepIndicator
//
// Step progress indicator for multi-step flows.
// ============================================================

import { StackLayout, Label } from '@nativescript/core';

export interface StepDef { id: string; label: string; description?: string; status?: 'completed' | 'current' | 'upcoming'; }

export interface StepIndicatorProps {
  steps: StepDef[];
  currentStep?: number;
  orientation?: 'horizontal' | 'vertical';
  size?: 'sm' | 'md' | 'lg';
}

export function createStepIndicator(props: StepIndicatorProps): StackLayout {
  const { steps, currentStep = 0, orientation = 'horizontal', size = 'md' } = props;
  const container = new StackLayout();
  container.className = `clef-widget-step-indicator clef-size-${size}`;
  container.orientation = orientation === 'horizontal' ? 'horizontal' : 'vertical';

  steps.forEach((step, i) => {
    const stepView = new StackLayout();
    stepView.orientation = 'horizontal';
    stepView.verticalAlignment = 'middle';
    const num = new Label();
    num.text = (step.status === 'completed' || i < currentStep) ? '\u2713' : String(i + 1);
    num.fontWeight = 'bold';
    num.marginRight = 4;
    stepView.addChild(num);
    const lbl = new Label();
    lbl.text = step.label;
    if (i > currentStep) lbl.opacity = 0.5;
    stepView.addChild(lbl);
    container.addChild(stepView);
    if (i < steps.length - 1) {
      const sep = new Label();
      sep.text = orientation === 'horizontal' ? ' \u2014 ' : '';
      sep.opacity = 0.3;
      container.addChild(sep);
    }
  });
  return container;
}

export default createStepIndicator;
