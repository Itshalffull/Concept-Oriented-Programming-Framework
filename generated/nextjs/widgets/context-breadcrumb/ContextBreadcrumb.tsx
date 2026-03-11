'use client';

// ============================================================
// Clef Surface Next.js Widget — ContextBreadcrumb
//
// Horizontal breadcrumb bar showing the active version space
// context stack. Each chip represents a nested version space,
// with the rightmost chip being the most specific active space.
// Users can dismiss spaces or switch to sibling spaces via dropdown.
// Serves the context-stack interactor type (Section 5.10.2).
// ============================================================

import React, { useState, useCallback, useRef, useEffect } from 'react';

// --------------- Types ---------------

export interface ContextEntry {
  spaceId: string;
  spaceName: string;
  isDeepest?: boolean;
}

export interface SiblingSpace {
  spaceId: string;
  spaceName: string;
}

// --------------- Props ---------------

export interface ContextBreadcrumbProps {
  /** Stack of context entries representing nested version spaces. */
  stack?: ContextEntry[];
  /** Maximum number of chips visible before collapsing. */
  maxVisibleChips?: number;
  /** Callback when a space is dismissed from the stack. */
  onDismiss?: (spaceId: string) => void;
  /** Callback when switching to a sibling space. */
  onSwitch?: (spaceId: string) => void;
  /** Callback when a chip is selected. */
  onSelect?: (spaceId: string) => void;
  /** Sibling spaces available for switching. */
  siblings?: SiblingSpace[];
}

// --------------- State Machine ---------------

type DisplayState = 'collapsed' | 'expanded';
type DropdownState = 'closed' | 'open';

// --------------- Component ---------------

export const ContextBreadcrumb: React.FC<ContextBreadcrumbProps> = ({
  stack = [],
  maxVisibleChips = 5,
  onDismiss,
  onSwitch,
  onSelect,
  siblings = [],
}) => {
  const [displayState, setDisplayState] = useState<DisplayState>(
    stack.length > maxVisibleChips ? 'collapsed' : 'expanded',
  );
  const [dropdownState, setDropdownState] = useState<DropdownState>('closed');
  const [activeDropdownChip, setActiveDropdownChip] = useState<string | null>(null);
  const rootRef = useRef<HTMLElement>(null);

  // State machine transitions
  const handleExpand = useCallback(() => {
    setDisplayState('expanded');
  }, []);

  const handleCollapse = useCallback(() => {
    setDisplayState('collapsed');
  }, []);

  const handleOpenDropdown = useCallback((spaceId: string) => {
    setActiveDropdownChip(spaceId);
    setDropdownState('open');
  }, []);

  const handleCloseDropdown = useCallback(() => {
    setDropdownState('closed');
    setActiveDropdownChip(null);
  }, []);

  const handleSelectSibling = useCallback(
    (spaceId: string) => {
      setDropdownState('closed');
      setActiveDropdownChip(null);
      onSwitch?.(spaceId);
    },
    [onSwitch],
  );

  const handleDismiss = useCallback(
    (spaceId: string) => {
      onDismiss?.(spaceId);
    },
    [onDismiss],
  );

  const handleChipSelect = useCallback(
    (spaceId: string) => {
      onSelect?.(spaceId);
    },
    [onSelect],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          if (dropdownState === 'open') {
            handleCloseDropdown();
          } else {
            handleCollapse();
          }
          break;
        case 'ArrowDown':
          if (dropdownState === 'closed') {
            const deepest = stack[stack.length - 1];
            if (deepest) handleOpenDropdown(deepest.spaceId);
          }
          break;
      }
    },
    [dropdownState, handleCloseDropdown, handleCollapse, handleOpenDropdown, stack],
  );

  // Determine visible chips
  const isCollapsed = displayState === 'collapsed';
  const visibleChips = isCollapsed
    ? stack.slice(-1)
    : stack.slice(-(maxVisibleChips));
  const hiddenCount = Math.max(0, stack.length - visibleChips.length);

  return (
    <nav
      ref={rootRef}
      role="navigation"
      aria-label="Version space context"
      data-state={displayState}
      data-depth={stack.length}
      data-part="root"
      onKeyDown={handleKeyDown}
    >
      {/* Depth count badge — visible only when collapsed */}
      {hiddenCount > 0 && (
        <span
          data-part="depth-count"
          aria-label={`${stack.length} spaces in stack`}
          hidden={displayState === 'expanded'}
          onClick={handleExpand}
        >
          +{hiddenCount}
        </span>
      )}

      {/* Bar containing chips */}
      <div role="list" aria-label="Active version spaces" data-part="bar">
        {visibleChips.map((entry, index) => {
          const isDeepest =
            entry.isDeepest ?? index === visibleChips.length - 1;

          return (
            <div
              key={entry.spaceId}
              role="listitem"
              data-space-id={entry.spaceId}
              data-deepest={isDeepest ? 'true' : 'false'}
              data-part="chip"
              aria-current={isDeepest ? 'true' : 'false'}
            >
              {/* Chip label */}
              <span
                data-part="chip-label"
                onClick={() => handleChipSelect(entry.spaceId)}
              >
                {entry.spaceName}
              </span>

              {/* Dismiss button */}
              <button
                data-part="chip-dismiss"
                aria-label={`Leave ${entry.spaceName}`}
                onClick={() => handleDismiss(entry.spaceId)}
                type="button"
              />

              {/* Dropdown trigger */}
              <button
                data-part="dropdown-trigger"
                aria-haspopup="listbox"
                aria-expanded={
                  dropdownState === 'open' && activeDropdownChip === entry.spaceId
                    ? 'true'
                    : 'false'
                }
                aria-label="Switch to sibling space"
                onClick={() =>
                  dropdownState === 'open' && activeDropdownChip === entry.spaceId
                    ? handleCloseDropdown()
                    : handleOpenDropdown(entry.spaceId)
                }
                type="button"
              />

              {/* Dropdown menu */}
              {dropdownState === 'open' && activeDropdownChip === entry.spaceId && (
                <div data-part="dropdown-menu" role="listbox">
                  {siblings.map((sibling) => (
                    <div
                      key={sibling.spaceId}
                      data-part="dropdown-item"
                      role="option"
                      onClick={() => handleSelectSibling(sibling.spaceId)}
                    >
                      {sibling.spaceName}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
};

ContextBreadcrumb.displayName = 'ContextBreadcrumb';
export default ContextBreadcrumb;
