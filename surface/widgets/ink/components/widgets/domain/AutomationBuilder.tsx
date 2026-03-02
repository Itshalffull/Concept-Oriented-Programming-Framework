// ============================================================
// Clef Surface Ink Widget — AutomationBuilder
//
// Linear step-sequence builder for constructing automation rules.
// Renders a vertical flow of steps connected by arrow connectors,
// with keyboard-driven navigation, step configuration, and an
// add-step action at the end.
//
// Adapts the automation-builder.widget spec: anatomy (root,
// stepList, step, stepIcon, stepType, stepConfig, addStepButton,
// connector), states (idle, stepSelected, configuring, addingStep,
// reordering, testingStep, testing), and connect attributes to
// terminal rendering.
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface AutomationStep {
  id: string;
  type: string;
  config?: Record<string, unknown>;
}

// --------------- Props ---------------

export interface AutomationBuilderProps {
  /** Ordered list of automation steps. */
  steps: AutomationStep[];
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
  /** Callback to add a new step at the end. */
  onAddStep?: () => void;
  /** Callback to remove a step by id. */
  onRemoveStep?: (id: string) => void;
  /** Callback to configure a step by id. */
  onConfigure?: (id: string) => void;
}

// --------------- Component ---------------

export const AutomationBuilder: React.FC<AutomationBuilderProps> = ({
  steps,
  isFocused = false,
  onAddStep,
  onRemoveStep,
  onConfigure,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [addFocused, setAddFocused] = useState(false);

  const totalItems = steps.length + 1; // steps + add button

  useInput(
    (input, key) => {
      if (!isFocused) return;

      if (key.downArrow) {
        setSelectedIndex((i) => Math.min(i + 1, totalItems - 1));
        setAddFocused(selectedIndex + 1 >= steps.length);
      } else if (key.upArrow) {
        setSelectedIndex((i) => Math.max(i - 1, 0));
        setAddFocused(false);
      } else if (key.return) {
        if (selectedIndex >= steps.length) {
          onAddStep?.();
        } else {
          const step = steps[selectedIndex];
          if (step) onConfigure?.(step.id);
        }
      } else if (key.delete || (input === 'd' && !key.ctrl)) {
        if (selectedIndex < steps.length) {
          const step = steps[selectedIndex];
          if (step) onRemoveStep?.(step.id);
        }
      } else if (input === 'n') {
        onAddStep?.();
      }
    },
    { isActive: isFocused },
  );

  return (
    <Box flexDirection="column">
      {steps.map((step, index) => {
        const isSelected = isFocused && selectedIndex === index;
        return (
          <Box key={step.id} flexDirection="column">
            <Box>
              <Text
                inverse={isSelected}
                bold={isSelected}
                color={isSelected ? 'cyan' : undefined}
              >
                {isSelected ? '\u276F ' : '  '}
                [{index + 1}] {step.type}
                {step.config ? ' (configured)' : ' (unconfigured)'}
              </Text>
            </Box>
            {index < steps.length - 1 && (
              <Box paddingLeft={2}>
                <Text dimColor>  |</Text>
              </Box>
            )}
          </Box>
        );
      })}

      {steps.length > 0 && (
        <Box paddingLeft={2}>
          <Text dimColor>  |</Text>
        </Box>
      )}

      <Box>
        <Text
          inverse={isFocused && selectedIndex >= steps.length}
          bold={isFocused && selectedIndex >= steps.length}
          color={isFocused && selectedIndex >= steps.length ? 'green' : 'green'}
        >
          {isFocused && selectedIndex >= steps.length ? '\u276F ' : '  '}
          [+ Add Step]
        </Text>
      </Box>

      {isFocused && (
        <Box marginTop={1}>
          <Text dimColor>
            {'\u2191\u2193'} navigate {'  '} Enter configure/add {'  '} d
            remove {'  '} n new step
          </Text>
        </Box>
      )}
    </Box>
  );
};

AutomationBuilder.displayName = 'AutomationBuilder';
export default AutomationBuilder;
