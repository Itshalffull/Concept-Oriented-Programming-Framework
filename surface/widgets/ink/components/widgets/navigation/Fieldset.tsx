// ============================================================
// Clef Surface Ink Widget — Fieldset
//
// Form field grouping container with accessible legend for
// terminal display. Renders a bordered box with legend text
// integrated at the top using box-drawing characters.
// Maps fieldset.widget anatomy (root, legend, content,
// description) to Ink Box/Text with dimColor when disabled.
// See Architecture doc Section 16.
// ============================================================

import React from 'react';
import { Box, Text } from 'ink';

// --------------- Props ---------------

export interface FieldsetProps {
  /** Legend heading for the field group. */
  legend: string;
  /** Whether the fieldset and all children are disabled. */
  disabled?: boolean;
  /** Grouped form fields. */
  children?: React.ReactNode;
}

// --------------- Component ---------------

export const Fieldset: React.FC<FieldsetProps> = ({
  legend,
  disabled = false,
  children,
}) => {
  return (
    <Box flexDirection="column">
      {/* Legend row with box-drawing integration */}
      <Box>
        <Text dimColor={disabled}>
          {'\u2500\u2524'}{' '}
        </Text>
        <Text bold dimColor={disabled}>
          {legend}
        </Text>
        <Text dimColor={disabled}>
          {' '}{'\u251C\u2500'}
        </Text>
      </Box>

      {/* Content area with border */}
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor={disabled ? 'gray' : undefined}
        paddingX={1}
      >
        {disabled ? (
          <Text dimColor>
            {typeof children === 'string' ? children : ''}
          </Text>
        ) : (
          children
        )}
        {disabled && typeof children !== 'string' && children}
      </Box>
    </Box>
  );
};

Fieldset.displayName = 'Fieldset';
export default Fieldset;
