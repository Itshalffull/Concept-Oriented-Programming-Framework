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
