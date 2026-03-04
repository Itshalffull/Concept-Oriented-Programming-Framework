/* ---------------------------------------------------------------------------
 * DiffViewer reducer — extracted state machine
 * States: mode, loading, expand, navigation
 * ------------------------------------------------------------------------- */

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
  highlights?: { start: number; end: number }[];
}

export interface DiffViewerState {
  mode: 'sideBySide' | 'unified';
  loading: 'idle' | 'loading' | 'error';
  expandedRanges: Set<string>;
  selectedFile: string | null;
  currentChangeIndex: number;
}

export type DiffViewerEvent =
  | { type: 'SWITCH_TO_UNIFIED' }
  | { type: 'SWITCH_TO_SIDE_BY_SIDE' }
  | { type: 'EXPAND'; key: string }
  | { type: 'COLLAPSE'; key: string }
  | { type: 'SELECT_FILE'; fileName: string }
  | { type: 'NEXT_CHANGE' }
  | { type: 'PREV_CHANGE' };

export function diffViewerReducer(
  state: DiffViewerState,
  event: DiffViewerEvent,
): DiffViewerState {
  switch (event.type) {
    case 'SWITCH_TO_UNIFIED':
      return { ...state, mode: 'unified' };
    case 'SWITCH_TO_SIDE_BY_SIDE':
      return { ...state, mode: 'sideBySide' };
    case 'EXPAND': {
      const expanded = new Set(state.expandedRanges);
      expanded.add(event.key);
      return { ...state, expandedRanges: expanded };
    }
    case 'COLLAPSE': {
      const expanded = new Set(state.expandedRanges);
      expanded.delete(event.key);
      return { ...state, expandedRanges: expanded };
    }
    case 'SELECT_FILE':
      return { ...state, selectedFile: event.fileName };
    case 'NEXT_CHANGE':
      return { ...state, currentChangeIndex: state.currentChangeIndex + 1 };
    case 'PREV_CHANGE':
      return { ...state, currentChangeIndex: Math.max(0, state.currentChangeIndex - 1) };
    default:
      return state;
  }
}

export function computeDiffLines(original: string, modified: string): DiffLine[] {
  const oldLines = original.split('\n');
  const newLines = modified.split('\n');
  const result: DiffLine[] = [];
  const maxLen = Math.max(oldLines.length, newLines.length);

  let oldIdx = 0;
  let newIdx = 0;

  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldIdx < oldLines.length ? oldLines[oldIdx] : undefined;
    const newLine = newIdx < newLines.length ? newLines[newIdx] : undefined;

    if (oldLine === newLine) {
      result.push({
        type: 'unchanged',
        content: oldLine ?? '',
        oldLineNumber: oldIdx + 1,
        newLineNumber: newIdx + 1,
      });
      oldIdx++;
      newIdx++;
    } else if (oldLine !== undefined && (newLine === undefined || oldLine !== newLines[newIdx])) {
      result.push({
        type: 'removed',
        content: oldLine,
        oldLineNumber: oldIdx + 1,
      });
      oldIdx++;
      i--; // re-check newIdx
      if (newIdx < newLines.length && newLines[newIdx] !== oldLines[oldIdx]) {
        // continue
      }
    } else {
      result.push({
        type: 'added',
        content: newLine ?? '',
        newLineNumber: newIdx + 1,
      });
      newIdx++;
    }
  }

  return result;
}


import {
  forwardRef,
  useCallback,
  useMemo,
  useReducer,
  useRef,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

import { diffViewerReducer, computeDiffLines } from './DiffViewer.reducer.js';
import type { DiffLine } from './DiffViewer.reducer.js';

/* ---------------------------------------------------------------------------
 * Types derived from diff-viewer.widget spec props
 * ------------------------------------------------------------------------- */

export type { DiffLine };

export interface FileDiff {
  fileName: string;
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
}

export interface DiffHunk {
  range: string;
  lines: DiffLine[];
}

export interface DiffViewerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  original?: string;
  modified?: string;
  mode?: 'side-by-side' | 'unified';
  language?: string;
  fileName?: string;
  files?: FileDiff[];
  contextLines?: number;
  showLineNumbers?: boolean;
  showInlineHighlight?: boolean;
  showFileList?: boolean;
  expandCollapsed?: boolean;
  loading?: boolean;
  additions?: number;
  deletions?: number;
  onModeChange?: (mode: 'side-by-side' | 'unified') => void;
  onFileSelect?: (fileName: string) => void;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export const DiffViewer = forwardRef<HTMLDivElement, DiffViewerProps>(
  function DiffViewer(
    {
      original = '',
      modified = '',
      mode: controlledMode = 'side-by-side',
      language,
      fileName,
      files = [],
      contextLines = 3,
      showLineNumbers = true,
      showInlineHighlight = true,
      showFileList = true,
      expandCollapsed = false,
      loading = false,
      additions: controlledAdditions = 0,
      deletions: controlledDeletions = 0,
      onModeChange,
      onFileSelect,
      children,
      ...rest
    },
    ref,
  ) {
    const [state, send] = useReducer(diffViewerReducer, {
      mode: controlledMode === 'unified' ? 'unified' : 'sideBySide',
      loading: loading ? 'loading' : 'idle',
      expandedRanges: new Set(),
      selectedFile: files.length > 0 ? files[0].fileName : null,
      currentChangeIndex: 0,
    });

    const diffLines = useMemo(() => computeDiffLines(original, modified), [original, modified]);
    const additions = controlledAdditions || diffLines.filter((l) => l.type === 'added').length;
    const deletions = controlledDeletions || diffLines.filter((l) => l.type === 'removed').length;
    const modeDisplay = state.mode === 'sideBySide' ? 'side-by-side' : 'unified';

    const handleModeToggle = useCallback(() => {
      const newMode = state.mode === 'sideBySide' ? 'unified' : 'sideBySide';
      send({ type: newMode === 'unified' ? 'SWITCH_TO_UNIFIED' : 'SWITCH_TO_SIDE_BY_SIDE' });
      onModeChange?.(newMode === 'unified' ? 'unified' : 'side-by-side');
    }, [state.mode, onModeChange]);

    return (
      <div
        ref={ref}
        role="region"
        aria-label={fileName ? `Diff viewer: ${fileName}` : 'Diff viewer'}
        aria-busy={loading ? 'true' : 'false'}
        data-surface-widget=""
        data-widget-name="diff-viewer"
        data-part="root"
        data-mode={modeDisplay}
        data-state={loading ? 'loading' : 'idle'}
        {...rest}
      >
        {/* Toolbar */}
        <div role="toolbar" aria-label="Diff controls" data-part="toolbar">
          <button
            type="button"
            data-part="mode-toggle"
            aria-label="Diff view mode"
            onClick={handleModeToggle}
          >
            {modeDisplay}
          </button>

          <span
            data-part="change-stats"
            data-additions={additions}
            data-deletions={deletions}
            aria-live="polite"
            aria-atomic="true"
            aria-label={`${additions} additions, ${deletions} deletions`}
          >
            +{additions} -{deletions}
          </span>

          <button
            type="button"
            data-part="prev-change-button"
            aria-label="Previous change"
            onClick={() => send({ type: 'PREV_CHANGE' })}
          >
            Prev
          </button>
          <button
            type="button"
            data-part="next-change-button"
            aria-label="Next change"
            onClick={() => send({ type: 'NEXT_CHANGE' })}
          >
            Next
          </button>
        </div>

        {/* File List */}
        {showFileList && files.length > 1 && (
          <div role="list" aria-label="Changed files" data-part="file-list">
            {files.map((file) => (
              <div
                key={file.fileName}
                role="listitem"
                data-part="file-item"
                data-file={file.fileName}
                data-selected={state.selectedFile === file.fileName ? 'true' : 'false'}
                tabIndex={0}
                onClick={() => {
                  send({ type: 'SELECT_FILE', fileName: file.fileName });
                  onFileSelect?.(file.fileName);
                }}
              >
                <span data-part="file-item-name">{file.fileName}</span>
                <span data-part="file-item-stats" aria-hidden="true">
                  +{file.additions} -{file.deletions}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Diff Panel */}
        <div
          role="document"
          aria-label={state.mode === 'sideBySide' ? 'Side-by-side diff' : 'Unified diff'}
          aria-roledescription="diff"
          data-part="diff-panel"
          data-mode={modeDisplay}
          tabIndex={0}
        >
          {state.mode === 'sideBySide' ? (
            <div data-part="side-by-side-container">
              <div data-part="left-header">Original</div>
              <div data-part="right-header">Modified</div>
              <div role="region" aria-label="Original version" data-part="left-pane">
                {diffLines
                  .filter((l) => l.type !== 'added')
                  .map((line, i) => (
                    <div
                      key={`left-${i}`}
                      data-part={
                        line.type === 'removed' ? 'removed-line' : 'unchanged-line'
                      }
                      data-line={line.oldLineNumber}
                      aria-label={
                        line.type === 'removed'
                          ? `Removed line ${line.oldLineNumber}: ${line.content}`
                          : `Line ${line.oldLineNumber}`
                      }
                    >
                      {showLineNumbers && (
                        <span data-part="line-number" aria-hidden="true">
                          {line.oldLineNumber}
                        </span>
                      )}
                      <span data-part="line-content">{line.content}</span>
                    </div>
                  ))}
              </div>
              <div role="region" aria-label="Modified version" data-part="right-pane">
                {diffLines
                  .filter((l) => l.type !== 'removed')
                  .map((line, i) => (
                    <div
                      key={`right-${i}`}
                      data-part={
                        line.type === 'added' ? 'added-line' : 'unchanged-line'
                      }
                      data-line={line.newLineNumber}
                      aria-label={
                        line.type === 'added'
                          ? `Added line ${line.newLineNumber}: ${line.content}`
                          : `Line ${line.newLineNumber}`
                      }
                    >
                      {showLineNumbers && (
                        <span data-part="line-number" aria-hidden="true">
                          {line.newLineNumber}
                        </span>
                      )}
                      <span data-part="line-content">{line.content}</span>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            /* Unified mode */
            <div data-part="unified-container">
              {diffLines.map((line, i) => (
                <div
                  key={`unified-${i}`}
                  data-part={
                    line.type === 'added'
                      ? 'added-line'
                      : line.type === 'removed'
                        ? 'removed-line'
                        : 'unchanged-line'
                  }
                  data-line={line.newLineNumber ?? line.oldLineNumber}
                  aria-label={
                    line.type === 'added'
                      ? `Added line ${line.newLineNumber}: ${line.content}`
                      : line.type === 'removed'
                        ? `Removed line ${line.oldLineNumber}: ${line.content}`
                        : `Line ${line.oldLineNumber}`
                  }
                >
                  {showLineNumbers && (
                    <>
                      <span data-part="line-number" aria-hidden="true">
                        {line.oldLineNumber ?? ''}
                      </span>
                      <span data-part="line-number" aria-hidden="true">
                        {line.newLineNumber ?? ''}
                      </span>
                    </>
                  )}
                  <span data-part="line-prefix" aria-hidden="true">
                    {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                  </span>
                  <span data-part="line-content">{line.content}</span>
                  {showInlineHighlight && line.highlights && (
                    <span
                      data-part="inline-highlight"
                      data-type={line.type}
                      aria-hidden="true"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {children}
      </div>
    );
  },
);

DiffViewer.displayName = 'DiffViewer';
export default DiffViewer;
