// ============================================================
// Clef Surface Ink Widget — ScrollLock
//
// Prevents body-level scrolling in DOM environments when active.
// Terminal output is inherently non-scrollable in the Ink sense,
// so this component is a no-op that renders nothing.
//
// Adapts the scroll-lock.widget spec: anatomy (root), states
// (unlocked, locked), and connect attributes (data-part,
// data-state, data-scroll-lock) to terminal rendering.
// ============================================================

import React from 'react';

// --------------- Props ---------------

export interface ScrollLockProps {
  /** Whether the scroll lock is active. */
  active?: boolean;
  /** Whether to preserve the scrollbar gap (no-op in terminal). */
  preserveScrollbarGap?: boolean;
  /** data-part attribute. */
  dataPart?: string;
  /** data-state attribute override. */
  dataState?: string;
}

// --------------- Component ---------------

export const ScrollLock: React.FC<ScrollLockProps> = ({
  active = false,
  preserveScrollbarGap = true,
  dataPart,
  dataState,
}) => {
  // Terminal environments have no scrollbar to lock.
  return null;
};

ScrollLock.displayName = 'ScrollLock';
export default ScrollLock;
