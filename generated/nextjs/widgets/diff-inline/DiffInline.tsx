'use client';

// ============================================================
// Clef Surface Next.js Widget — DiffInline
//
// Single-column inline diff view for field-level and line-level
// comparisons. Shows merged content with insertions and deletions
// highlighted. Supports two-way and three-way diffs with conflict
// markers. Interactive mode adds accept/reject buttons per hunk.
// Serves the diff-view interactor type (Section 5.10.3).
// ============================================================

import React, { useState, useCallback } from 'react';

// --------------- Types ---------------

export interface DiffHunk {
  hunkId: string;
  header?: string;
  lines: DiffLine[];
}

export interface DiffLine {
  type: 'inserted' | 'deleted' | 'unchanged' | 'conflict-source' | 'conflict-target' | 'conflict-ancestor';
  content: string;
  lineNumberSource?: number;
  lineNumberTarget?: number;
}

export interface DiffConflict {
  source: string;
  target: string;
  ancestor?: string;
}

// --------------- Props ---------------

export interface DiffInlineProps {
  /** Source version content. */
  source?: string;
  /** Target version content. */
  target?: string;
  /** Ancestor content for three-way diffs. */
  ancestor?: string;
  /** Number of diff ways: 2 or 3. */
  wayCount?: 2 | 3;
  /** Diff granularity. */
  granularity?: 'field' | 'line';
  /** Whether interactive mode is enabled. */
  interactive?: boolean;
  /** Whether to show line numbers. */
  showLineNumbers?: boolean;
  /** Label for the source version. */
  sourceLabel?: string;
  /** Label for the target version. */
  targetLabel?: string;
  /** Pre-computed hunks to render. */
  hunks?: DiffHunk[];
  /** Callback when a hunk is accepted. */
  onAcceptHunk?: (hunkId: string) => void;
  /** Callback when a hunk is rejected. */
  onRejectHunk?: (hunkId: string) => void;
}

// --------------- State Machine ---------------

type ModeState = 'viewing' | 'interactive';
type HunkDecision = 'pending' | 'accepted' | 'rejected';

// --------------- Component ---------------

export const DiffInline: React.FC<DiffInlineProps> = ({
  source = '',
  target = '',
  ancestor,
  wayCount = 2,
  granularity = 'line',
  interactive = false,
  showLineNumbers = true,
  sourceLabel = 'Original',
  targetLabel = 'Modified',
  hunks = [],
  onAcceptHunk,
  onRejectHunk,
}) => {
  const [modeState, setModeState] = useState<ModeState>(
    interactive ? 'interactive' : 'viewing',
  );
  const [hunkDecisions, setHunkDecisions] = useState<Record<string, HunkDecision>>({});

  // Sync interactive prop to state
  React.useEffect(() => {
    setModeState(interactive ? 'interactive' : 'viewing');
  }, [interactive]);

  const handleAcceptHunk = useCallback(
    (hunkId: string) => {
      setHunkDecisions((prev) => ({ ...prev, [hunkId]: 'accepted' }));
      onAcceptHunk?.(hunkId);
    },
    [onAcceptHunk],
  );

  const handleRejectHunk = useCallback(
    (hunkId: string) => {
      setHunkDecisions((prev) => ({ ...prev, [hunkId]: 'rejected' }));
      onRejectHunk?.(hunkId);
    },
    [onRejectHunk],
  );

  const handleResetHunk = useCallback((hunkId: string) => {
    setHunkDecisions((prev) => ({ ...prev, [hunkId]: 'pending' }));
  }, []);

  return (
    <div
      role="region"
      aria-label="Inline diff view"
      data-way-count={wayCount}
      data-granularity={granularity}
      data-interactive={interactive ? 'true' : 'false'}
      data-part="root"
    >
      {/* Header */}
      <div data-part="header">
        <span data-part="source-label">{sourceLabel}</span>
        <span data-part="target-label">{targetLabel}</span>
      </div>

      {/* Content */}
      <div role="document" aria-roledescription="diff" data-part="content">
        {hunks.map((hunk) => {
          const decision = hunkDecisions[hunk.hunkId] ?? 'pending';

          return (
            <div key={hunk.hunkId} data-part="hunk" data-decision={decision}>
              {/* Hunk header */}
              {hunk.header && (
                <div data-part="hunk-header">{hunk.header}</div>
              )}

              {/* Lines */}
              {hunk.lines.map((line, lineIdx) => {
                if (line.type === 'inserted') {
                  return (
                    <div
                      key={lineIdx}
                      data-part="inserted-line"
                      data-type="addition"
                      aria-label={`Added: ${line.content}`}
                    >
                      {showLineNumbers && (
                        <span data-part="line-number">{line.lineNumberTarget}</span>
                      )}
                      <span data-part="line-content">{line.content}</span>
                    </div>
                  );
                }

                if (line.type === 'deleted') {
                  return (
                    <div
                      key={lineIdx}
                      data-part="deleted-line"
                      data-type="deletion"
                      aria-label={`Removed: ${line.content}`}
                    >
                      {showLineNumbers && (
                        <span data-part="line-number">{line.lineNumberSource}</span>
                      )}
                      <span data-part="line-content">{line.content}</span>
                    </div>
                  );
                }

                if (line.type === 'unchanged') {
                  return (
                    <div key={lineIdx} data-part="unchanged-line">
                      {showLineNumbers && (
                        <span data-part="line-number">{line.lineNumberSource}</span>
                      )}
                      <span data-part="line-content">{line.content}</span>
                    </div>
                  );
                }

                if (
                  line.type === 'conflict-source' ||
                  line.type === 'conflict-target' ||
                  line.type === 'conflict-ancestor'
                ) {
                  return (
                    <div
                      key={lineIdx}
                      data-part="conflict-marker"
                      role="group"
                      aria-label="Merge conflict"
                    >
                      <span data-part="line-content">{line.content}</span>
                    </div>
                  );
                }

                return null;
              })}

              {/* Hunk actions — visible only in interactive mode */}
              <div
                data-part="hunk-actions"
                hidden={!interactive}
              >
                <button
                  data-part="accept-button"
                  aria-label="Accept changes in this hunk"
                  onClick={() => handleAcceptHunk(hunk.hunkId)}
                  type="button"
                />
                <button
                  data-part="reject-button"
                  aria-label="Reject changes in this hunk"
                  onClick={() => handleRejectHunk(hunk.hunkId)}
                  type="button"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

DiffInline.displayName = 'DiffInline';
export default DiffInline;
