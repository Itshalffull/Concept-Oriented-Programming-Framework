// ============================================================
// Clef Surface Ink Widget — Disclosure
//
// Single expand/collapse toggle for terminal display.
// The simplest form of progressive disclosure: a trigger
// label with indicator and a controlled content panel.
// Maps disclosure.widget anatomy (root, trigger, indicator,
// content) to Ink Box/Text with useInput toggle.
// See Architecture doc Section 16.
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Props ---------------

export interface DisclosureProps {
  /** Whether the content is expanded. */
  open?: boolean;
  /** Trigger label text. */
  label: string;
  /** Content to display when expanded. */
  children?: React.ReactNode;
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
  /** Callback when the disclosure is toggled. */
  onToggle?: (open: boolean) => void;
}

// --------------- Component ---------------

export const Disclosure: React.FC<DisclosureProps> = ({
  open: controlledOpen,
  label,
  children,
  isFocused = false,
  onToggle,
}) => {
  const [internalOpen, setInternalOpen] = useState(controlledOpen ?? false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;

  const toggle = useCallback(() => {
    const next = !isOpen;
    setInternalOpen(next);
    onToggle?.(next);
  }, [isOpen, onToggle]);

  useInput(
    (input, key) => {
      if (!isFocused) return;
      if (key.return || input === ' ') {
        toggle();
      }
    },
    { isActive: isFocused },
  );

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={isFocused ? 'cyan' : undefined}>
          {isOpen ? '\u25BC' : '\u25B6'}{' '}
        </Text>
        <Text bold={isFocused} color={isFocused ? 'cyan' : undefined}>
          {label}
        </Text>
      </Box>
      {isOpen && (
        <Box marginLeft={2}>
          {typeof children === 'string' ? <Text>{children}</Text> : children}
        </Box>
      )}
    </Box>
  );
};

Disclosure.displayName = 'Disclosure';
export default Disclosure;
