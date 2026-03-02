// ============================================================
// Clef Surface Ink Widget — Portal
//
// In DOM environments, a portal renders children into a
// different location in the tree to escape clipping and
// stacking contexts. Terminal rendering has no such constraints,
// so this component simply renders its children in place.
//
// Adapts the portal.widget spec: anatomy (root), states
// (unmounted, mounted), and connect attributes (data-part,
// data-portal, data-state) to terminal rendering.
// ============================================================

import React, { type ReactNode } from 'react';

// --------------- Props ---------------

export interface PortalProps {
  /** Content to render through the portal. */
  children?: ReactNode;
  /** Target container ID (no-op in terminal). */
  target?: string;
  /** Whether the portal is disabled. */
  disabled?: boolean;
  /** data-part attribute. */
  dataPart?: string;
  /** data-state attribute override. */
  dataState?: string;
}

// --------------- Component ---------------

export const Portal: React.FC<PortalProps> = ({
  children,
  target,
  disabled = false,
  dataPart,
  dataState,
}) => {
  // In a terminal environment there are no DOM portals.
  // Render children directly in place.
  return <>{children}</>;
};

Portal.displayName = 'Portal';
export default Portal;
