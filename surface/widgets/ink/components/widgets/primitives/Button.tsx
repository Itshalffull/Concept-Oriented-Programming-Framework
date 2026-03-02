// ============================================================
// Clef Surface Ink Widget — Button
//
// Generic action trigger rendered in the terminal. Displays as
// [ Label ] with visual variants communicated through Ink text
// styles: inverse for focused, dimColor for disabled, and a
// spinning character for the loading state.
//
// Adapts the button.widget spec: anatomy (root, label, icon,
// spinner), states (idle, hovered, focused, pressed, disabled,
// loading), and connect attributes (data-variant, data-size,
// data-state, role) to terminal rendering.
// ============================================================

import React, { useState, useEffect, type ReactNode } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Props ---------------

export interface ButtonProps {
  /** Visual variant of the button. */
  variant?: 'filled' | 'outline' | 'text' | 'danger';
  /** Size controlling padding around the label. */
  size?: 'sm' | 'md' | 'lg';
  /** Whether the button is disabled. */
  disabled?: boolean;
  /** Whether the button is in a loading state. */
  loading?: boolean;
  /** Content to display inside the button. */
  children?: ReactNode;
  /** Whether this button currently has focus and receives keyboard input. */
  isFocused?: boolean;
  /** Callback when the button is activated (Enter or Space). */
  onPress?: () => void;
  /** data-part attribute. */
  dataPart?: string;
  /** data-state attribute override. */
  dataState?: string;
  /** data-variant attribute override. */
  dataVariant?: string;
}

// --------------- Helpers ---------------

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

const PADDING: Record<string, number> = {
  sm: 0,
  md: 1,
  lg: 2,
};

// --------------- Component ---------------

export const Button: React.FC<ButtonProps> = ({
  variant = 'filled',
  size = 'md',
  disabled = false,
  loading = false,
  children,
  isFocused = false,
  onPress,
  dataPart,
  dataState,
  dataVariant,
}) => {
  const [spinnerIndex, setSpinnerIndex] = useState(0);

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setSpinnerIndex((prev) => (prev + 1) % SPINNER_FRAMES.length);
    }, 80);
    return () => clearInterval(interval);
  }, [loading]);

  useInput(
    (_input, key) => {
      if (disabled || loading) return;
      if (key.return) {
        onPress?.();
      }
    },
    { isActive: isFocused },
  );

  const pad = PADDING[size] ?? PADDING.md;
  const padStr = ' '.repeat(pad);

  const resolvedState = dataState ?? (loading ? 'loading' : disabled ? 'disabled' : 'idle');

  const isDanger = variant === 'danger';
  const isOutline = variant === 'outline';
  const isText = variant === 'text';

  const labelContent = loading ? (
    <Text>{SPINNER_FRAMES[spinnerIndex]} </Text>
  ) : null;

  const textColor = isDanger ? 'red' : undefined;

  if (isText) {
    return (
      <Box>
        <Text
          dimColor={disabled}
          bold={isFocused}
          inverse={isFocused && !disabled}
          color={textColor}
        >
          {padStr}
          {labelContent}
          {children}
          {padStr}
        </Text>
      </Box>
    );
  }

  const bracket = isOutline ? ['[ ', ' ]'] : ['[ ', ' ]'];

  return (
    <Box>
      <Text
        dimColor={disabled}
        bold={isFocused && !disabled}
        inverse={isFocused && !disabled && variant === 'filled'}
        color={textColor}
      >
        {bracket[0]}
        {padStr}
        {labelContent}
        {children}
        {padStr}
        {bracket[1]}
      </Text>
    </Box>
  );
};

Button.displayName = 'Button';
export default Button;
