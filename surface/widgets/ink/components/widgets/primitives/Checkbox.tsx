// ============================================================
// Clef Surface Ink Widget — Checkbox
//
// Boolean toggle control for the terminal. Renders as [x] or
// [ ] followed by a label. Space key toggles the checked state
// when the component has focus.
//
// Adapts the checkbox.widget spec: anatomy (root, input,
// control, indicator, label), states (unchecked, checked,
// indeterminate, disabled, focused), and connect attributes
// (data-part, data-state, data-disabled) to terminal rendering.
// ============================================================

import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Props ---------------

export interface CheckboxProps {
  /** Whether the checkbox is checked (controlled). */
  checked?: boolean;
  /** Whether the checkbox is in indeterminate state. */
  indeterminate?: boolean;
  /** Whether the checkbox is disabled. */
  disabled?: boolean;
  /** Label text displayed next to the checkbox. */
  label?: string;
  /** Whether this checkbox has focus and receives keyboard input. */
  isFocused?: boolean;
  /** Callback when the checked value changes. */
  onChange?: (checked: boolean) => void;
  /** Whether the field is required. */
  required?: boolean;
  /** data-part attribute. */
  dataPart?: string;
  /** data-state attribute override. */
  dataState?: string;
}

// --------------- Component ---------------

export const Checkbox: React.FC<CheckboxProps> = ({
  checked: controlledChecked,
  indeterminate = false,
  disabled = false,
  label,
  isFocused = false,
  onChange,
  required = false,
  dataPart,
  dataState,
}) => {
  const [internalChecked, setInternalChecked] = useState(controlledChecked ?? false);

  const isChecked = controlledChecked !== undefined ? controlledChecked : internalChecked;

  useEffect(() => {
    if (controlledChecked !== undefined) {
      setInternalChecked(controlledChecked);
    }
  }, [controlledChecked]);

  const toggle = useCallback(() => {
    if (disabled) return;
    const next = !isChecked;
    setInternalChecked(next);
    onChange?.(next);
  }, [disabled, isChecked, onChange]);

  useInput(
    (input, _key) => {
      if (input === ' ') {
        toggle();
      }
    },
    { isActive: isFocused },
  );

  let indicator: string;
  if (indeterminate) {
    indicator = '[-]';
  } else if (isChecked) {
    indicator = '[x]';
  } else {
    indicator = '[ ]';
  }

  const resolvedState = dataState ?? (isChecked ? 'checked' : indeterminate ? 'indeterminate' : 'unchecked');

  return (
    <Box>
      <Text
        bold={isFocused}
        dimColor={disabled}
        inverse={isFocused && !disabled}
      >
        {indicator}
      </Text>
      {label && (
        <Text dimColor={disabled}>
          {' '}
          {label}
          {required && <Text color="red"> *</Text>}
        </Text>
      )}
    </Box>
  );
};

Checkbox.displayName = 'Checkbox';
export default Checkbox;
