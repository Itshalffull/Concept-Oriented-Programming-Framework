// ============================================================
// Clef Surface NativeScript Widget — Stepper
//
// Multi-step form wizard with step indicators and
// navigation controls.
// ============================================================

import { StackLayout, Label, Button, Color } from '@nativescript/core';
import type { View } from '@nativescript/core';

// --------------- Props ---------------

export interface StepperStep {
  title: string;
  description?: string;
  content?: View;
}

export interface StepperProps {
  steps: StepperStep[];
  activeStep?: number;
  orientation?: 'horizontal' | 'vertical';
  onStepChange?: (step: number) => void;
}

// --------------- Component ---------------

export function createStepper(props: StepperProps): StackLayout {
  const {
    steps = [],
    activeStep = 0,
    orientation = 'horizontal',
    onStepChange,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-widget-stepper';

  const stepsBar = new StackLayout();
  stepsBar.orientation = orientation;
  stepsBar.className = 'clef-stepper-indicators';

  steps.forEach((step, idx) => {
    const stepContainer = new StackLayout();
    stepContainer.orientation = 'horizontal';
    stepContainer.verticalAlignment = 'middle';
    stepContainer.marginRight = 8;

    const badge = new Label();
    badge.text = String(idx + 1);
    badge.width = 24;
    badge.height = 24;
    badge.horizontalAlignment = 'center';
    badge.verticalAlignment = 'middle';
    badge.borderRadius = 12;
    badge.textAlignment = 'center';
    badge.fontSize = 12;

    if (idx < activeStep) {
      badge.text = '\u2713';
      badge.backgroundColor = new Color('#22c55e');
      badge.color = new Color('#ffffff');
    } else if (idx === activeStep) {
      badge.backgroundColor = new Color('#3b82f6');
      badge.color = new Color('#ffffff');
    } else {
      badge.backgroundColor = new Color('#e5e7eb');
    }

    stepContainer.addChild(badge);

    const titleLabel = new Label();
    titleLabel.text = step.title;
    titleLabel.marginLeft = 4;
    titleLabel.fontSize = 12;
    if (idx === activeStep) titleLabel.fontWeight = 'bold';
    stepContainer.addChild(titleLabel);

    stepsBar.addChild(stepContainer);
  });

  container.addChild(stepsBar);

  if (steps[activeStep]?.content) {
    const contentArea = new StackLayout();
    contentArea.className = 'clef-stepper-content';
    contentArea.marginTop = 12;
    contentArea.addChild(steps[activeStep].content!);
    container.addChild(contentArea);
  }

  const navRow = new StackLayout();
  navRow.orientation = 'horizontal';
  navRow.marginTop = 12;

  if (activeStep > 0) {
    const prevBtn = new Button();
    prevBtn.text = 'Previous';
    prevBtn.className = 'clef-stepper-prev';
    prevBtn.on('tap', () => onStepChange?.(activeStep - 1));
    navRow.addChild(prevBtn);
  }

  if (activeStep < steps.length - 1) {
    const nextBtn = new Button();
    nextBtn.text = 'Next';
    nextBtn.className = 'clef-stepper-next';
    nextBtn.horizontalAlignment = 'right';
    nextBtn.on('tap', () => onStepChange?.(activeStep + 1));
    navRow.addChild(nextBtn);
  }

  container.addChild(navRow);
  return container;
}

export default createStepper;
