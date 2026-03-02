// ============================================================
// Clef Surface Ink Widget — Form
//
// Form container for terminal managing submission lifecycle.
// Wraps children in a vertical column layout and provides
// submit handling. Maps form.widget anatomy (root, fields,
// actions, submitButton, resetButton, errorSummary) to
// Ink Box/Text with useInput for enter-to-submit.
// See Architecture doc Section 16.
// ============================================================

import React, { useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Props ---------------

export interface FormProps {
  /** Form field and action children. */
  children?: React.ReactNode;
  /** Callback when the form is submitted. */
  onSubmit?: () => void;
}

// --------------- Component ---------------

export const Form: React.FC<FormProps> = ({
  children,
  onSubmit,
}) => {
  useInput(
    useCallback(
      (_input, key) => {
        if (key.return) {
          onSubmit?.();
        }
      },
      [onSubmit],
    ),
  );

  return (
    <Box flexDirection="column">
      {children}
    </Box>
  );
};

Form.displayName = 'Form';
export default Form;
