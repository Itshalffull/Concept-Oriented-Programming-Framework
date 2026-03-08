'use client';

// ============================================================
// Clef Surface Next.js Widget — ContextBar
//
// Persistent full-width bar below the navigation header serving
// as the primary reality indicator for version spaces. Shows the
// current space name, visibility icon, nesting breadcrumb, and
// quick-action buttons. Color-coded by space status.
// Serves the context-stack interactor type (Section 5.10.3).
// ============================================================

import React, { useState, useCallback } from 'react';

// --------------- Types ---------------

export interface ContextEntry {
  spaceId: string;
  spaceName: string;
}

// --------------- Props ---------------

export type SpaceStatus = 'active' | 'proposed' | 'archived';
export type SpaceVisibility = 'private' | 'shared' | 'public';

export interface ContextBarProps {
  /** Stack of context entries representing nested version spaces. */
  stack?: ContextEntry[];
  /** Current space name. */
  spaceName?: string;
  /** Current space status. */
  spaceStatus?: SpaceStatus;
  /** Current space visibility. */
  spaceVisibility?: SpaceVisibility;
  /** Number of overrides in the current space. */
  overrideCount?: number;
  /** Callback when leaving the current space. */
  onLeave?: () => void;
  /** Callback when switching to a different space. */
  onSwitch?: () => void;
  /** Callback when viewing the diff. */
  onViewDiff?: () => void;
}

// --------------- Component ---------------

export const ContextBar: React.FC<ContextBarProps> = ({
  stack = [],
  spaceName = '',
  spaceStatus = 'active',
  spaceVisibility = 'private',
  overrideCount = 0,
  onLeave,
  onSwitch,
  onViewDiff,
}) => {
  const [status, setStatus] = useState<SpaceStatus>(spaceStatus);
  const [visibility, setVisibility] = useState<SpaceVisibility>(spaceVisibility);

  // Sync controlled props
  React.useEffect(() => { setStatus(spaceStatus); }, [spaceStatus]);
  React.useEffect(() => { setVisibility(spaceVisibility); }, [spaceVisibility]);

  const handleLeave = useCallback(() => {
    onLeave?.();
  }, [onLeave]);

  const handleSwitch = useCallback(() => {
    onSwitch?.();
  }, [onSwitch]);

  const handleViewDiff = useCallback(() => {
    onViewDiff?.();
  }, [onViewDiff]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          handleLeave();
          break;
        case 'd':
        case 'D':
          handleViewDiff();
          break;
      }
    },
    [handleLeave, handleViewDiff],
  );

  // Build parent breadcrumb (all entries except the last one)
  const parentEntries = stack.slice(0, -1);

  return (
    <div
      role="banner"
      aria-label={`Version space: ${spaceName}`}
      data-status={status}
      data-visibility={visibility}
      data-part="root"
      onKeyDown={handleKeyDown}
    >
      {/* Status icon */}
      <span
        data-visibility={visibility}
        aria-label={visibility}
        data-part="status-icon"
      />

      {/* Space name */}
      <span data-part="space-name" aria-current="true">
        {spaceName}
      </span>

      {/* Breadcrumb */}
      <nav role="navigation" aria-label="Space nesting" data-part="breadcrumb">
        {parentEntries.map((entry, index) => (
          <React.Fragment key={entry.spaceId}>
            <span data-part="breadcrumb-item">{entry.spaceName}</span>
            {index < parentEntries.length - 1 && (
              <span data-part="breadcrumb-sep" aria-hidden="true">
                /
              </span>
            )}
          </React.Fragment>
        ))}
      </nav>

      {/* Actions */}
      <div data-part="actions">
        <button
          data-part="leave-button"
          aria-label={`Leave ${spaceName}`}
          onClick={handleLeave}
          type="button"
        />
        <button
          data-part="switch-button"
          aria-label="Switch version space"
          onClick={handleSwitch}
          type="button"
        />
        <button
          data-part="diff-button"
          aria-label={`View ${overrideCount} changes from base`}
          data-badge={overrideCount > 0 ? overrideCount : ''}
          onClick={handleViewDiff}
          type="button"
        />
      </div>
    </div>
  );
};

ContextBar.displayName = 'ContextBar';
export default ContextBar;
