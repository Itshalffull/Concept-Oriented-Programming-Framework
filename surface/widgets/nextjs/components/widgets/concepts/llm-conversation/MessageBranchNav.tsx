/* ---------------------------------------------------------------------------
 * MessageBranchNav — Server Component
 *
 * Navigation control for conversation branches showing the current
 * branch position and prev/next/edit controls.
 * ------------------------------------------------------------------------- */

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface MessageBranchNavProps {
  /** Zero-based index of the current branch. */
  currentIndex: number;
  /** Total number of branches. */
  totalBranches: number;
  /** Show the edit button. */
  showEdit?: boolean;
  /** Use compact layout. */
  compact?: boolean;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export default function MessageBranchNav({
  currentIndex,
  totalBranches,
  showEdit = true,
  compact = false,
}: MessageBranchNavProps) {
  const isFirst = currentIndex <= 0;
  const isLast = currentIndex >= totalBranches - 1;
  const displayIndex = currentIndex + 1;

  return (
    <div
      role="navigation"
      aria-label={`Branch ${displayIndex} of ${totalBranches}`}
      data-surface-widget=""
      data-widget-name="message-branch-nav"
      data-part="root"
      data-state="viewing"
      data-compact={compact ? '' : undefined}
      tabIndex={0}
    >
      <button
        type="button"
        data-part="prev"
        data-state="viewing"
        aria-label="Previous version"
        aria-disabled={isFirst ? 'true' : 'false'}
        disabled={isFirst}
        tabIndex={0}
      >
        &#9664;
      </button>
      <span data-part="indicator" data-state="viewing">
        {displayIndex} / {totalBranches}
      </span>
      <button
        type="button"
        data-part="next"
        data-state="viewing"
        aria-label="Next version"
        aria-disabled={isLast ? 'true' : 'false'}
        disabled={isLast}
        tabIndex={0}
      >
        &#9654;
      </button>
      {showEdit && (
        <button
          type="button"
          data-part="edit"
          data-state="viewing"
          aria-label="Edit and branch"
          tabIndex={0}
        >
          &#9998;
        </button>
      )}
    </div>
  );
}

export { MessageBranchNav };
