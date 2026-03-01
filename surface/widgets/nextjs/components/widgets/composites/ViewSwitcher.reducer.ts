/* ---------------------------------------------------------------------------
 * ViewSwitcher reducer — extracted state machine
 * States: view, viewMenu, config, rename
 * ------------------------------------------------------------------------- */

export interface ViewSwitcherState {
  menuOpen: boolean;
  configExpanded: boolean;
  renamingViewId: string | null;
  renameValue: string;
}

export type ViewSwitcherEvent =
  | { type: 'OPEN_MENU' }
  | { type: 'CLOSE_MENU' }
  | { type: 'TOGGLE_CONFIG' }
  | { type: 'START_RENAME'; viewId: string; name: string }
  | { type: 'COMMIT_RENAME' }
  | { type: 'CANCEL_RENAME' }
  | { type: 'UPDATE_RENAME_VALUE'; value: string }
  | { type: 'SWITCH_VIEW' };

export function viewSwitcherReducer(
  state: ViewSwitcherState,
  event: ViewSwitcherEvent,
): ViewSwitcherState {
  switch (event.type) {
    case 'OPEN_MENU':
      return { ...state, menuOpen: true };
    case 'CLOSE_MENU':
      return { ...state, menuOpen: false };
    case 'TOGGLE_CONFIG':
      return { ...state, configExpanded: !state.configExpanded };
    case 'START_RENAME':
      return { ...state, renamingViewId: event.viewId, renameValue: event.name };
    case 'COMMIT_RENAME':
      return { ...state, renamingViewId: null, renameValue: '' };
    case 'CANCEL_RENAME':
      return { ...state, renamingViewId: null, renameValue: '' };
    case 'UPDATE_RENAME_VALUE':
      return { ...state, renameValue: event.value };
    case 'SWITCH_VIEW':
      return { ...state, configExpanded: false };
    default:
      return state;
  }
}
