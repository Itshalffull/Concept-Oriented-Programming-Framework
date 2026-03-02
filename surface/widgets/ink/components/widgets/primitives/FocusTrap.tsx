// ============================================================
// Clef Surface Ink Widget — FocusTrap
//
// Conceptual focus-trap wrapper for the terminal. In a DOM
// environment this constrains Tab focus within a boundary. In
// the terminal, focus management is handled by the Ink framework
// itself, so this component simply wraps children transparently.
//
// Adapts the focus-trap.widget spec: anatomy (root,
// sentinelStart, sentinelEnd), states (inactive, active), and
// connect attributes (data-part, data-state, data-focus-trap)
// to terminal rendering.
// ============================================================

import React, { type ReactNode } from 'react';
import { Box } from 'ink';

// --------------- Props ---------------

export interface FocusTrapProps {
  /** Whether the focus trap is active. */
  active?: boolean;
  /** Content wrapped by the focus trap. */
  children?: ReactNode;
  /** Whether to return focus on deactivation. */
  returnFocus?: boolean;
  /** Whether Tab focus should loop within the trap. */
  loop?: boolean;
  /** data-part attribute. */
  dataPart?: string;
  /** data-state attribute override. */
  dataState?: string;
}

// --------------- Component ---------------

export const FocusTrap: React.FC<FocusTrapProps> = ({
  active = false,
  children,
  returnFocus = true,
  loop = true,
  dataPart,
  dataState,
}) => {
  // In a terminal environment, focus trapping is a no-op. The Ink
  // framework manages focus natively. We render the children inside
  // a Box to maintain a consistent wrapper element.
  return <Box flexDirection="column">{children}</Box>;
};

FocusTrap.displayName = 'FocusTrap';
export default FocusTrap;
