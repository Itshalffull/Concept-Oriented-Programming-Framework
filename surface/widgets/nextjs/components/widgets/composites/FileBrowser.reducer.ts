/* ---------------------------------------------------------------------------
 * FileBrowser reducer — extracted state machine
 * States: view, selection, upload, sidebar, loading, rename
 * ------------------------------------------------------------------------- */

export interface FileBrowserState {
  view: 'grid' | 'list';
  selection: 'none' | 'single' | 'multiple';
  upload: 'idle' | 'dragOver' | 'uploading' | 'error';
  sidebar: 'hidden' | 'visible';
  loading: 'idle' | 'loading' | 'error';
  rename: 'idle' | 'renaming';
  selectedIds: string[];
  renamingId: string | null;
  renameValue: string;
  searchQuery: string;
}

export type FileBrowserEvent =
  | { type: 'SWITCH_TO_GRID' }
  | { type: 'SWITCH_TO_LIST' }
  | { type: 'SELECT'; id: string }
  | { type: 'SELECT_ADDITIONAL'; id: string }
  | { type: 'DESELECT_ALL' }
  | { type: 'DRAG_ENTER' }
  | { type: 'DRAG_LEAVE' }
  | { type: 'DROP' }
  | { type: 'UPLOAD_COMPLETE' }
  | { type: 'SHOW_DETAIL' }
  | { type: 'HIDE_DETAIL' }
  | { type: 'START_RENAME'; id: string; name: string }
  | { type: 'COMMIT_RENAME' }
  | { type: 'CANCEL_RENAME' }
  | { type: 'UPDATE_RENAME'; value: string }
  | { type: 'SET_SEARCH'; value: string };

export function fileBrowserReducer(
  state: FileBrowserState,
  event: FileBrowserEvent,
): FileBrowserState {
  switch (event.type) {
    case 'SWITCH_TO_GRID':
      return { ...state, view: 'grid' };
    case 'SWITCH_TO_LIST':
      return { ...state, view: 'list' };
    case 'SELECT':
      return {
        ...state,
        selectedIds: [event.id],
        selection: 'single',
        sidebar: 'visible',
      };
    case 'SELECT_ADDITIONAL': {
      const ids = state.selectedIds.includes(event.id)
        ? state.selectedIds.filter((id) => id !== event.id)
        : [...state.selectedIds, event.id];
      return {
        ...state,
        selectedIds: ids,
        selection: ids.length === 0 ? 'none' : ids.length === 1 ? 'single' : 'multiple',
        sidebar: ids.length > 0 ? 'visible' : 'hidden',
      };
    }
    case 'DESELECT_ALL':
      return { ...state, selectedIds: [], selection: 'none', sidebar: 'hidden' };
    case 'DRAG_ENTER':
      return { ...state, upload: 'dragOver' };
    case 'DRAG_LEAVE':
      return { ...state, upload: 'idle' };
    case 'DROP':
      return { ...state, upload: 'uploading' };
    case 'UPLOAD_COMPLETE':
      return { ...state, upload: 'idle' };
    case 'SHOW_DETAIL':
      return { ...state, sidebar: 'visible' };
    case 'HIDE_DETAIL':
      return { ...state, sidebar: 'hidden' };
    case 'START_RENAME':
      return { ...state, rename: 'renaming', renamingId: event.id, renameValue: event.name };
    case 'COMMIT_RENAME':
      return { ...state, rename: 'idle', renamingId: null, renameValue: '' };
    case 'CANCEL_RENAME':
      return { ...state, rename: 'idle', renamingId: null, renameValue: '' };
    case 'UPDATE_RENAME':
      return { ...state, renameValue: event.value };
    case 'SET_SEARCH':
      return { ...state, searchQuery: event.value };
    default:
      return state;
  }
}
