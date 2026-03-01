// ---------------------------------------------------------------------------
// Sidebar reducer — expanded/collapsed state for side navigation panel.
// ---------------------------------------------------------------------------

export type SidebarState = 'expanded' | 'collapsed';

export type SidebarAction =
  | { type: 'EXPAND' }
  | { type: 'COLLAPSE' };

export function sidebarReducer(state: SidebarState, action: SidebarAction): SidebarState {
  switch (action.type) {
    case 'EXPAND':
      return 'expanded';
    case 'COLLAPSE':
      return 'collapsed';
    default:
      return state;
  }
}
