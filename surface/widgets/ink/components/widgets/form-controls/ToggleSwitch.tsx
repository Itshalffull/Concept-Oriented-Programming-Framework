// ============================================================
// Clef Surface Ink Widget — ToggleSwitch
//
// Binary on/off toggle control for terminal. Renders a compact
// sliding indicator with ON/OFF text label. Space key toggles
// the state. Maps the toggle-switch.widget anatomy (root,
// input, control, thumb, label) to Ink Box/Text.
// ============================================================

import React, { useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Props ---------------

export interface ToggleSwitchProps {
  /** Whether the switch is in the ON state. */
  checked: boolean;
  /** Disables the toggle when true. */
  disabled?: boolean;
  /** Visible label describing the toggle. */
  label?: string;
  /** Whether this component receives keyboard input. */
  isFocused?: boolean;
  /** Called when the toggle state changes. */
  onChange?: (checked: boolean) => void;
}

// --------------- Component ---------------

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  disabled = false,
  label,
  isFocused = false,
  onChange,
}) => {
  const toggle = useCallback(() => {
    if (disabled || !onChange) return;
    onChange(!checked);
  }, [disabled, onChange, checked]);

  useInput(
    (input, key) => {
      if (disabled) return;

      if (input === ' ' || key.return) {
        toggle();
      }
    },
    { isActive: isFocused },
  );

  // Visual toggle indicator
  const switchDisplay = checked
    ? '[\u25CF\u25CB]'   // [filled empty] = ON position
    : '[\u25CB\u25CF]';  // [empty filled] = OFF position

  const stateLabel = checked ? 'ON' : 'OFF';

  return (
    <Box>
      <Text
        color={disabled ? 'gray' : checked ? 'green' : 'red'}
        bold={!disabled}
        dimColor={disabled}
      >
        {switchDisplay}
      </Text>
      <Text
        color={disabled ? 'gray' : checked ? 'green' : 'red'}
        dimColor={disabled}
      >
        {' '}{stateLabel}
      </Text>
      {label && (
        <Text color={disabled ? 'gray' : undefined} dimColor={disabled}>
          {' '}{label}
        </Text>
      )}
    </Box>
  );
};

ToggleSwitch.displayName = 'ToggleSwitch';
export default ToggleSwitch;
