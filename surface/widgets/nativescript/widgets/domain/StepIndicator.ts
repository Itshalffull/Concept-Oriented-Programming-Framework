// ============================================================
// Clef Surface NativeScript Widget — StepIndicator
//
// Multi-step progress indicator. Renders numbered steps with
// connectors, showing completed, current, and upcoming status.
// Supports horizontal and vertical orientations, clickable
// navigation, and custom step descriptions.
// ============================================================

import {
  StackLayout,
  GridLayout,
  Label,
  Color,
  GestureTypes,
} from '@nativescript/core';

// --------------- Types ---------------

export type StepStatus = 'completed' | 'current' | 'upcoming';

export interface StepDef {
  label: string;
  description?: string;
}

export interface StepIndicatorProps {
  steps?: StepDef[];
  currentStep?: number;
  orientation?: 'horizontal' | 'vertical';
  clickable?: boolean;
  size?: 'sm' | 'md' | 'lg';
  accentColor?: string;
  completedColor?: string;
  onStepClick?: (index: number) => void;
}

// --------------- Helpers ---------------

const SIZE_CONFIG = {
  sm: { numberSize: 20, fontSize: 10, connectorLength: 20 },
  md: { numberSize: 28, fontSize: 12, connectorLength: 30 },
  lg: { numberSize: 36, fontSize: 14, connectorLength: 40 },
};

// --------------- Component ---------------

export function createStepIndicator(props: StepIndicatorProps = {}): StackLayout {
  const {
    steps = [],
    currentStep = 0,
    orientation = 'horizontal',
    clickable = false,
    size = 'md',
    accentColor = '#06b6d4',
    completedColor = '#22c55e',
    onStepClick,
  } = props;

  const config = SIZE_CONFIG[size];

  const container = new StackLayout();
  container.className = 'clef-step-indicator';
  container.orientation = orientation === 'horizontal' ? 'horizontal' : 'vertical';
  container.padding = 4;

  steps.forEach((step, index) => {
    const status: StepStatus =
      index < currentStep ? 'completed' :
      index === currentStep ? 'current' : 'upcoming';

    const isLast = index === steps.length - 1;

    // Step wrapper
    const stepWrapper = new StackLayout();
    stepWrapper.orientation = orientation === 'horizontal' ? 'horizontal' : 'vertical';
    if (orientation === 'horizontal') {
      stepWrapper.horizontalAlignment = 'center';
    }

    // Step circle + label
    const stepContent = new StackLayout();
    stepContent.horizontalAlignment = 'center';

    // Number circle
    const circle = new StackLayout();
    circle.width = config.numberSize;
    circle.height = config.numberSize;
    circle.borderRadius = config.numberSize / 2;
    circle.horizontalAlignment = 'center';
    circle.verticalAlignment = 'middle';

    const numberLabel = new Label();
    numberLabel.horizontalAlignment = 'center';
    numberLabel.verticalAlignment = 'middle';
    numberLabel.fontSize = config.fontSize;
    numberLabel.fontWeight = 'bold';

    switch (status) {
      case 'completed':
        circle.backgroundColor = new Color(completedColor);
        numberLabel.text = '\u2713';
        numberLabel.color = new Color('#ffffff');
        break;
      case 'current':
        circle.backgroundColor = new Color(accentColor);
        circle.borderWidth = 2;
        circle.borderColor = new Color(accentColor);
        numberLabel.text = String(index + 1);
        numberLabel.color = new Color('#000000');
        break;
      case 'upcoming':
        circle.backgroundColor = new Color('#00000000');
        circle.borderWidth = 2;
        circle.borderColor = new Color('#555555');
        numberLabel.text = String(index + 1);
        numberLabel.color = new Color('#888888');
        break;
    }

    circle.addChild(numberLabel);
    stepContent.addChild(circle);

    // Label
    const labelView = new Label();
    labelView.text = step.label;
    labelView.fontSize = config.fontSize - 1;
    labelView.marginTop = 4;
    labelView.horizontalAlignment = 'center';
    labelView.textAlignment = 'center';
    labelView.fontWeight = status === 'current' ? 'bold' : 'normal';
    labelView.color = new Color(
      status === 'completed' ? completedColor :
      status === 'current' ? accentColor : '#888888'
    );
    stepContent.addChild(labelView);

    // Description
    if (step.description) {
      const descLabel = new Label();
      descLabel.text = step.description;
      descLabel.fontSize = config.fontSize - 3;
      descLabel.opacity = 0.5;
      descLabel.horizontalAlignment = 'center';
      descLabel.textAlignment = 'center';
      descLabel.textWrap = true;
      descLabel.maxLines = 2;
      stepContent.addChild(descLabel);
    }

    // Click handler
    if (clickable) {
      stepContent.on(GestureTypes.tap as any, () => onStepClick?.(index));
    }

    stepWrapper.addChild(stepContent);

    // Connector (between steps)
    if (!isLast) {
      const connector = new Label();

      if (orientation === 'horizontal') {
        connector.text = '\u2500'.repeat(3);
        connector.marginLeft = 4;
        connector.marginRight = 4;
        connector.verticalAlignment = 'middle';
      } else {
        connector.text = '\u2502\n\u2502';
        connector.marginTop = 2;
        connector.marginBottom = 2;
        connector.horizontalAlignment = 'center';
      }

      connector.fontSize = config.fontSize - 2;
      connector.color = new Color(
        index < currentStep ? completedColor : '#555555'
      );

      stepWrapper.addChild(connector);
    }

    container.addChild(stepWrapper);
  });

  // Empty state
  if (steps.length === 0) {
    const emptyLabel = new Label();
    emptyLabel.text = 'No steps defined.';
    emptyLabel.opacity = 0.4;
    container.addChild(emptyLabel);
  }

  return container;
}

export default createStepIndicator;
