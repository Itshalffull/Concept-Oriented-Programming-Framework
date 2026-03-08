'use client';

// ============================================================
// Clef Surface Next.js Widget — ContextBadge
//
// Compact floating badge showing the active version space context
// on mobile and watch platforms. Displays the deepest space name
// with a color tint. Tapping expands to the full context stack
// as a bottom sheet or scrollable list.
// Serves the context-stack interactor type (Section 5.10.2).
// ============================================================

import React, { useState, useCallback } from 'react';

// --------------- Types ---------------

export interface ContextEntry {
  spaceId: string;
  spaceName: string;
}

// --------------- Props ---------------

export interface ContextBadgeProps {
  /** Stack of context entries representing nested version spaces. */
  stack?: ContextEntry[];
  /** Color reflecting space status. */
  statusColor?: string;
  /** Callback when a space is dismissed. */
  onDismiss?: (spaceId: string) => void;
  /** Callback when switching to a different space. */
  onSwitch?: (spaceId: string) => void;
}

// --------------- State Machine ---------------

type DisplayState = 'badge' | 'expanded';

// --------------- Component ---------------

export const ContextBadge: React.FC<ContextBadgeProps> = ({
  stack = [],
  statusColor = 'accent',
  onDismiss,
  onSwitch,
}) => {
  const [displayState, setDisplayState] = useState<DisplayState>('badge');

  const deepestEntry = stack[stack.length - 1];
  const deepestName = deepestEntry?.spaceName ?? '';

  // State machine transitions
  const handleTap = useCallback(() => {
    setDisplayState('expanded');
  }, []);

  const handleClose = useCallback(() => {
    setDisplayState('badge');
  }, []);

  const handleDismissSpace = useCallback(
    (spaceId: string) => {
      setDisplayState('badge');
      onDismiss?.(spaceId);
    },
    [onDismiss],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'Enter':
          if (displayState === 'badge') handleTap();
          break;
        case 'Escape':
          if (displayState === 'expanded') handleClose();
          break;
      }
    },
    [displayState, handleTap, handleClose],
  );

  return (
    <div
      role="status"
      aria-label={`Version space: ${deepestName}`}
      aria-live="polite"
      data-state={displayState === 'badge' ? 'collapsed' : 'expanded'}
      data-depth={stack.length}
      data-status={statusColor}
      data-part="root"
      onKeyDown={handleKeyDown}
    >
      {/* Label showing deepest space name */}
      <span data-part="label">{deepestName}</span>

      {/* Color tint indicator */}
      <span data-color={statusColor} data-part="color-tint" />

      {/* Expand trigger */}
      <button
        data-part="expand-trigger"
        aria-label="View version space stack"
        aria-expanded={displayState === 'expanded' ? 'true' : 'false'}
        onClick={handleTap}
        type="button"
      />

      {/* Bottom sheet / expanded list */}
      <div
        data-part="sheet"
        role="dialog"
        aria-label="Version space stack"
        aria-modal="true"
        hidden={displayState === 'badge'}
      >
        {/* Sheet header */}
        <div data-part="sheet-header">
          <button
            data-part="sheet-close"
            aria-label="Close"
            onClick={handleClose}
            type="button"
          />
        </div>

        {/* Stack list */}
        <div role="list" data-part="stack-list">
          {stack.map((entry) => (
            <div
              key={entry.spaceId}
              role="listitem"
              data-space-id={entry.spaceId}
              data-part="stack-item"
            >
              <span data-part="stack-item-label">{entry.spaceName}</span>
              <button
                data-part="stack-item-action"
                aria-label={`Leave ${entry.spaceName}`}
                onClick={() => handleDismissSpace(entry.spaceId)}
                type="button"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

ContextBadge.displayName = 'ContextBadge';
export default ContextBadge;
