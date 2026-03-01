/* ---------------------------------------------------------------------------
 * BacklinkPanel reducer — extracted state machine
 * States: panel, linkedSection, unlinkedSection, loading
 * ------------------------------------------------------------------------- */

export interface BacklinkPanelState {
  panel: 'expanded' | 'collapsed';
  linkedSection: 'expanded' | 'collapsed';
  unlinkedSection: 'expanded' | 'collapsed';
  loading: 'idle' | 'loading' | 'error';
}

export type BacklinkPanelEvent =
  | { type: 'EXPAND' }
  | { type: 'COLLAPSE' }
  | { type: 'EXPAND_LINKED' }
  | { type: 'COLLAPSE_LINKED' }
  | { type: 'EXPAND_UNLINKED' }
  | { type: 'COLLAPSE_UNLINKED' }
  | { type: 'LOAD' }
  | { type: 'LOAD_COMPLETE' }
  | { type: 'LOAD_ERROR' };

export function backlinkPanelReducer(
  state: BacklinkPanelState,
  event: BacklinkPanelEvent,
): BacklinkPanelState {
  switch (event.type) {
    case 'EXPAND':
      return { ...state, panel: 'expanded' };
    case 'COLLAPSE':
      return { ...state, panel: 'collapsed' };
    case 'EXPAND_LINKED':
      return { ...state, linkedSection: 'expanded' };
    case 'COLLAPSE_LINKED':
      return { ...state, linkedSection: 'collapsed' };
    case 'EXPAND_UNLINKED':
      return { ...state, unlinkedSection: 'expanded' };
    case 'COLLAPSE_UNLINKED':
      return { ...state, unlinkedSection: 'collapsed' };
    case 'LOAD':
      return { ...state, loading: 'loading' };
    case 'LOAD_COMPLETE':
      return { ...state, loading: 'idle' };
    case 'LOAD_ERROR':
      return { ...state, loading: 'error' };
    default:
      return state;
  }
}
