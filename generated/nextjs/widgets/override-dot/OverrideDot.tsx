'use client';

// ============================================================
// Clef Surface Next.js Widget — OverrideDot
//
// Small colored circle positioned at the top-right corner of a
// decorated widget indicating that the underlying entity or field
// has been modified in the current version space. Color encodes
// semantic: blue (modified), green (created), red (deleted),
// amber (conflict). Hovering shows a tooltip. Clicking triggers
// the diff-view interactor.
// Serves the overlay-indicator interactor type (Section 5.10.3).
// ============================================================

import React, { useState, useCallback } from 'react';

// --------------- Types ---------------

export type OverrideSemantic = 'modified' | 'created' | 'deleted' | 'conflict';
export type DotPosition = 'corner' | 'border' | 'inline';

// --------------- Props ---------------

export interface OverrideDotProps {
  /** Semantic meaning of the override. */
  semantic?: OverrideSemantic;
  /** Name of the version space where the change was made. */
  spaceName?: string;
  /** Entity ID of the overridden item. */
  entityId?: string;
  /** Position of the dot relative to decorated content. */
  position?: DotPosition;
  /** Callback when the dot is clicked to view the diff. */
  onViewDiff?: (entityId: string) => void;
  /** Children to render as decorated content. */
  children?: React.ReactNode;
}

// --------------- State Machine ---------------

type HoverState = 'idle' | 'hovering';

const SEMANTIC_COLOR_MAP: Record<OverrideSemantic, string> = {
  modified: 'blue',
  created: 'green',
  deleted: 'red',
  conflict: 'amber',
};

const TOOLTIP_TEXT_MAP: Record<OverrideSemantic, (spaceName: string) => string> = {
  modified: (name) => `Modified in ${name} \u2014 click to view diff`,
  created: (name) => `Created in ${name}`,
  deleted: (name) => `Deleted in ${name}`,
  conflict: (name) => `Conflict in ${name} \u2014 click to resolve`,
};

// --------------- Component ---------------

export const OverrideDot: React.FC<OverrideDotProps> = ({
  semantic = 'modified',
  spaceName = '',
  entityId = '',
  position = 'corner',
  onViewDiff,
  children,
}) => {
  const [hoverState, setHoverState] = useState<HoverState>('idle');

  const handlePointerEnter = useCallback(() => {
    setHoverState('hovering');
  }, []);

  const handlePointerLeave = useCallback(() => {
    setHoverState('idle');
  }, []);

  const handleClick = useCallback(() => {
    setHoverState('idle');
    onViewDiff?.(entityId);
  }, [onViewDiff, entityId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick],
  );

  const color = SEMANTIC_COLOR_MAP[semantic];
  const tooltipText = TOOLTIP_TEXT_MAP[semantic](spaceName);

  return (
    <div
      role="group"
      aria-label={`${semantic} in ${spaceName}`}
      data-semantic={semantic}
      data-position={position}
      data-part="root"
    >
      {/* The indicator dot */}
      <span
        role="status"
        aria-label={`${semantic} in version space ${spaceName}`}
        tabIndex={0}
        data-semantic={semantic}
        data-color={color}
        data-part="dot"
        onClick={handleClick}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onKeyDown={handleKeyDown}
      />

      {/* Tooltip */}
      <div
        role="tooltip"
        aria-hidden={hoverState === 'idle' ? 'true' : 'false'}
        data-part="tooltip"
        hidden={hoverState === 'idle'}
      >
        <span data-part="tooltip-text">{tooltipText}</span>
        <span data-part="tooltip-space-name">{spaceName}</span>
      </div>

      {/* Decorated content slot */}
      <div data-part="decorated-content">{children}</div>
    </div>
  );
};

OverrideDot.displayName = 'OverrideDot';
export default OverrideDot;
