'use client';

// ============================================================
// Clef Surface Next.js Widget — DiffUnified
//
// Single-column character-level diff view with word-diff highlighting.
// Designed for code blocks, formulas, and content where character-level
// precision matters. Shows character-level change highlighting within
// lines. Serves the diff-view interactor type (Section 5.10.3).
// ============================================================

import React, { useState, useCallback } from 'react';

// --------------- Types ---------------

export interface DiffWord {
  type: 'added' | 'removed' | 'unchanged';
  text: string;
}

export interface UnifiedDiffLine {
  lineNumber?: number;
  words: DiffWord[];
}

// --------------- Props ---------------

export interface DiffUnifiedProps {
  /** Source version content. */
  source?: string;
  /** Target version content. */
  target?: string;
  /** Diff granularity. */
  granularity?: string;
  /** Whether to show line numbers. */
  showLineNumbers?: boolean;
  /** Whether to show whitespace markers. */
  showWhitespace?: boolean;
  /** Label for the source version. */
  sourceLabel?: string;
  /** Label for the target version. */
  targetLabel?: string;
  /** Number of words added. */
  wordsAdded?: number;
  /** Number of words removed. */
  wordsRemoved?: number;
  /** Pre-computed diff lines. */
  lines?: UnifiedDiffLine[];
}

// --------------- State Machine ---------------

type WhitespaceState = 'normal' | 'showWhitespace';

// --------------- Component ---------------

export const DiffUnified: React.FC<DiffUnifiedProps> = ({
  source = '',
  target = '',
  granularity = 'character',
  showLineNumbers = true,
  showWhitespace: showWhitespaceProp = false,
  sourceLabel = 'Original',
  targetLabel = 'Modified',
  wordsAdded = 0,
  wordsRemoved = 0,
  lines = [],
}) => {
  const [whitespaceState, setWhitespaceState] = useState<WhitespaceState>(
    showWhitespaceProp ? 'showWhitespace' : 'normal',
  );

  // Sync prop to state
  React.useEffect(() => {
    setWhitespaceState(showWhitespaceProp ? 'showWhitespace' : 'normal');
  }, [showWhitespaceProp]);

  const handleToggleWhitespace = useCallback(() => {
    setWhitespaceState((prev) =>
      prev === 'normal' ? 'showWhitespace' : 'normal',
    );
  }, []);

  const isShowingWhitespace = whitespaceState === 'showWhitespace';
  const statsText = `+${wordsAdded} words, -${wordsRemoved} words`;

  return (
    <div
      role="region"
      aria-label="Unified character diff view"
      data-granularity="character"
      data-show-whitespace={isShowingWhitespace ? 'true' : 'false'}
      data-part="root"
    >
      {/* Header */}
      <div data-part="header">
        <span data-part="source-label">{sourceLabel}</span>
        <span data-part="target-label">{targetLabel}</span>
        <span data-part="change-stats" aria-live="polite">
          {statsText}
        </span>
      </div>

      {/* Content */}
      <div role="document" aria-roledescription="character diff" data-part="content">
        {lines.map((line, lineIdx) => (
          <div key={lineIdx} data-part="line">
            {/* Line number */}
            <span
              data-part="line-number"
              hidden={!showLineNumbers}
            >
              {line.lineNumber}
            </span>

            {/* Line content with word-level highlighting */}
            <span data-part="line-content">
              {line.words.map((word, wordIdx) => {
                if (word.type === 'added') {
                  return (
                    <span
                      key={wordIdx}
                      data-part="word-added"
                      data-type="addition"
                      aria-label={`Added: ${word.text}`}
                    >
                      {word.text}
                    </span>
                  );
                }

                if (word.type === 'removed') {
                  return (
                    <span
                      key={wordIdx}
                      data-part="word-removed"
                      data-type="deletion"
                      aria-label={`Removed: ${word.text}`}
                    >
                      {word.text}
                    </span>
                  );
                }

                return (
                  <span key={wordIdx} data-part="word-unchanged">
                    {word.text}
                  </span>
                );
              })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

DiffUnified.displayName = 'DiffUnified';
export default DiffUnified;
