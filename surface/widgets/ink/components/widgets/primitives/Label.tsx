// ============================================================
// Clef Surface Ink Widget — Label
//
// Accessible label text for a form control. Renders the label
// text with an optional red asterisk indicating required fields.
//
// Adapts the label.widget spec: anatomy (root,
// requiredIndicator), states (static), and connect attributes
// (data-part, for, data-visible on requiredIndicator)
// to terminal rendering.
// ============================================================

import React from 'react';
import { Box, Text } from 'ink';

// --------------- Props ---------------

export interface LabelProps {
  /** Label text content. */
  text?: string;
  /** Whether the associated field is required. */
  required?: boolean;
  /** ID of the form control this label refers to (no-op in terminal). */
  htmlFor?: string;
  /** Whether the associated control is disabled. */
  disabled?: boolean;
  /** data-part attribute. */
  dataPart?: string;
}

// --------------- Component ---------------

export const Label: React.FC<LabelProps> = ({
  text = '',
  required = false,
  htmlFor,
  disabled = false,
  dataPart,
}) => {
  return (
    <Box>
      <Text dimColor={disabled}>{text}</Text>
      {required && <Text color="red"> *</Text>}
    </Box>
  );
};

Label.displayName = 'Label';
export default Label;
