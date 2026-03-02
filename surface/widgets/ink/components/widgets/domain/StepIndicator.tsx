// ============================================================
// Clef Surface Ink Widget — StepIndicator
//
// Stepper and wizard progress indicator rendered in the terminal
// as a sequence of labeled steps connected by lines. Completed
// steps show a checkmark, the current step shows a filled circle,
// and pending steps show an empty bracket.
//
// Adapts the step-indicator.widget spec: anatomy (root, step,
// stepNumber, stepLabel, stepDescription, connector), states
// (upcoming, current, completed), and connect attributes.
// ============================================================

import React from 'react';
import { Box, Text } from 'ink';

// --------------- Types ---------------

export interface StepDef {
  label: string;
  status: 'completed' | 'current' | 'pending';
}

// --------------- Props ---------------

export interface StepIndicatorProps {
  /** Ordered list of steps with labels and statuses. */
  steps: StepDef[];
  /** Index of the current step (0-based). */
  currentStep?: number;
  /** Orientation of the indicator. */
  orientation?: 'horizontal' | 'vertical';
}

// --------------- Helpers ---------------

function statusIcon(status: string): string {
  switch (status) {
    case 'completed': return '\u2713';
    case 'current': return '\u25CF';
    default: return ' ';
  }
}

function statusColor(status: string): string | undefined {
  switch (status) {
    case 'completed': return 'green';
    case 'current': return 'cyan';
    default: return 'gray';
  }
}

// --------------- Component ---------------

export const StepIndicator: React.FC<StepIndicatorProps> = ({
  steps,
  currentStep,
  orientation = 'horizontal',
}) => {
  // Determine status from currentStep if individual statuses not set
  const resolvedSteps = steps.map((step, index) => {
    if (currentStep !== undefined) {
      const status =
        index < currentStep ? 'completed' :
        index === currentStep ? 'current' :
        'pending';
      return { ...step, status };
    }
    return step;
  });

  if (orientation === 'vertical') {
    return (
      <Box flexDirection="column">
        {resolvedSteps.map((step, index) => (
          <Box key={index} flexDirection="column">
            <Box>
              <Text color={statusColor(step.status) as any} bold={step.status === 'current'}>
                [{statusIcon(step.status)}]
              </Text>
              <Text
                bold={step.status === 'current'}
                dimColor={step.status === 'pending'}
              >
                {' '}{step.label}
              </Text>
            </Box>
            {index < resolvedSteps.length - 1 && (
              <Box paddingLeft={1}>
                <Text dimColor>{'\u2502'}</Text>
              </Box>
            )}
          </Box>
        ))}
      </Box>
    );
  }

  // Horizontal layout
  return (
    <Box>
      {resolvedSteps.map((step, index) => (
        <Box key={index}>
          <Text color={statusColor(step.status) as any} bold={step.status === 'current'}>
            [{statusIcon(step.status)}]
          </Text>
          <Text
            bold={step.status === 'current'}
            dimColor={step.status === 'pending'}
          >
            {' '}{step.label}
          </Text>
          {index < resolvedSteps.length - 1 && (
            <Text dimColor> {'\u2500\u2500\u2500'} </Text>
          )}
        </Box>
      ))}
    </Box>
  );
};

StepIndicator.displayName = 'StepIndicator';
export default StepIndicator;
