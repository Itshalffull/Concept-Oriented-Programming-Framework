// ============================================================
// Clef Surface Ink Widget — Presence
//
// Controls conditional rendering of children based on the
// `present` prop. In DOM environments this manages mount/unmount
// lifecycles with animation support. In the terminal, animations
// are not applicable, so children are simply shown or hidden.
//
// Adapts the presence.widget spec: anatomy (root), states
// (unmounted, mounting, mounted, unmounting), and connect
// attributes (data-part, data-state, data-present)
// to terminal rendering.
// ============================================================

import React, { type ReactNode } from 'react';

// --------------- Props ---------------

export interface PresenceProps {
  /** Whether the content should be visible. */
  present?: boolean;
  /** Content to conditionally render. */
  children?: ReactNode;
  /** Whether to animate on initial mount (no-op in terminal). */
  animateOnMount?: boolean;
  /** Force the content to remain mounted even when not present. */
  forceMount?: boolean;
  /** data-part attribute. */
  dataPart?: string;
  /** data-state attribute override. */
  dataState?: string;
}

// --------------- Component ---------------

export const Presence: React.FC<PresenceProps> = ({
  present = false,
  children,
  animateOnMount = false,
  forceMount = false,
  dataPart,
  dataState,
}) => {
  if (!present && !forceMount) {
    return null;
  }

  return <>{children}</>;
};

Presence.displayName = 'Presence';
export default Presence;
