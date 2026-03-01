/* ---------------------------------------------------------------------------
 * PluginCard reducer — extracted state machine
 * States: lifecycle, hover, focus
 * ------------------------------------------------------------------------- */

export type PluginLifecycleState = 'available' | 'installing' | 'installed' | 'enabled' | 'uninstalling';

export interface PluginCardState {
  lifecycle: PluginLifecycleState;
  hover: 'idle' | 'hovered';
  focus: 'unfocused' | 'focused';
}

export type PluginCardEvent =
  | { type: 'INSTALL' }
  | { type: 'INSTALL_COMPLETE' }
  | { type: 'INSTALL_ERROR' }
  | { type: 'ENABLE' }
  | { type: 'DISABLE' }
  | { type: 'UNINSTALL' }
  | { type: 'UNINSTALL_COMPLETE' }
  | { type: 'UNINSTALL_ERROR' }
  | { type: 'POINTER_ENTER' }
  | { type: 'POINTER_LEAVE' }
  | { type: 'FOCUS' }
  | { type: 'BLUR' };

export function pluginCardReducer(
  state: PluginCardState,
  event: PluginCardEvent,
): PluginCardState {
  switch (event.type) {
    case 'INSTALL':
      return { ...state, lifecycle: 'installing' };
    case 'INSTALL_COMPLETE':
      return { ...state, lifecycle: 'installed' };
    case 'INSTALL_ERROR':
      return { ...state, lifecycle: 'available' };
    case 'ENABLE':
      return { ...state, lifecycle: 'enabled' };
    case 'DISABLE':
      return { ...state, lifecycle: 'installed' };
    case 'UNINSTALL':
      return { ...state, lifecycle: 'uninstalling' };
    case 'UNINSTALL_COMPLETE':
      return { ...state, lifecycle: 'available' };
    case 'UNINSTALL_ERROR':
      return { ...state, lifecycle: 'installed' };
    case 'POINTER_ENTER':
      return { ...state, hover: 'hovered' };
    case 'POINTER_LEAVE':
      return { ...state, hover: 'idle' };
    case 'FOCUS':
      return { ...state, focus: 'focused' };
    case 'BLUR':
      return { ...state, focus: 'unfocused' };
    default:
      return state;
  }
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function buttonLabel(lifecycle: PluginLifecycleState): string {
  switch (lifecycle) {
    case 'available': return 'Install';
    case 'installing': return 'Installing...';
    case 'installed': return 'Enable';
    case 'enabled': return 'Disable';
    case 'uninstalling': return 'Uninstalling...';
    default: return 'Install';
  }
}
