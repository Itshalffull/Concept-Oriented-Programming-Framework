// ============================================================
// Clef Surface Ink Widget — VisuallyHidden
//
// Renders content that is invisible to sighted users but
// accessible to screen readers. In DOM environments this uses
// CSS clipping. In the terminal there is no assistive technology
// layer, so this component renders nothing.
//
// Adapts the visually-hidden.widget spec: anatomy (root), states
// (static), and connect attributes (data-part, style)
// to terminal rendering.
// ============================================================

import React, { type ReactNode } from 'react';

// --------------- Props ---------------

export interface VisuallyHiddenProps {
  /** Content intended for screen readers only. */
  children?: ReactNode;
  /** Text content (alternative to children). */
  text?: string;
  /** data-part attribute. */
  dataPart?: string;
}

// --------------- Component ---------------

export const VisuallyHidden: React.FC<VisuallyHiddenProps> = ({
  children,
  text,
  dataPart,
}) => {
  // Terminal environments do not have a separate assistive
  // technology channel. Render nothing to keep the output clean.
  return null;
};

VisuallyHidden.displayName = 'VisuallyHidden';
export default VisuallyHidden;
