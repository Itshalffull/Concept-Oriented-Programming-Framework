/* ---------------------------------------------------------------------------
 * PluginDetailPage state machine
 * Main: idle (initial), installing, installed, uninstalling, updating
 * Tab: description (initial), screenshots, reviews, changelog
 * ------------------------------------------------------------------------- */

export interface PDPState {
  install: 'idle' | 'installing' | 'installed' | 'uninstalling' | 'updating';
  tab: 'description' | 'screenshots' | 'reviews' | 'changelog';
}

export type PDPEvent =
  | { type: 'INSTALL' }
  | { type: 'INSTALL_COMPLETE' }
  | { type: 'INSTALL_ERROR' }
  | { type: 'UNINSTALL' }
  | { type: 'UNINSTALL_COMPLETE' }
  | { type: 'UNINSTALL_ERROR' }
  | { type: 'UPDATE' }
  | { type: 'UPDATE_COMPLETE' }
  | { type: 'UPDATE_ERROR' }
  | { type: 'SWITCH_TAB'; tab: PDPState['tab'] };

export function pdpReducer(state: PDPState, event: PDPEvent): PDPState {
  switch (event.type) {
    case 'INSTALL':
      return { ...state, install: 'installing' };
    case 'INSTALL_COMPLETE':
      return { ...state, install: 'installed' };
    case 'INSTALL_ERROR':
      return { ...state, install: 'idle' };
    case 'UNINSTALL':
      return { ...state, install: 'uninstalling' };
    case 'UNINSTALL_COMPLETE':
      return { ...state, install: 'idle' };
    case 'UNINSTALL_ERROR':
      return { ...state, install: 'installed' };
    case 'UPDATE':
      return { ...state, install: 'updating' };
    case 'UPDATE_COMPLETE':
    case 'UPDATE_ERROR':
      return { ...state, install: 'installed' };
    case 'SWITCH_TAB':
      return { ...state, tab: event.tab };
    default:
      return state;
  }
}
