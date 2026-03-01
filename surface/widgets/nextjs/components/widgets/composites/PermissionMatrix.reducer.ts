/* ---------------------------------------------------------------------------
 * PermissionMatrix reducer — extracted state machine
 * States: group (expanded | collapsed), saving (idle | pending | saving)
 * ------------------------------------------------------------------------- */

export interface ResourceDef {
  key: string;
  name: string;
  actions: { key: string; name: string }[];
}

export type PermissionMap = Record<string, Record<string, string[]>>;

export interface PermissionMatrixState {
  collapsedGroups: Set<string>;
  saving: 'idle' | 'pending' | 'saving';
  focusRow: number;
  focusCol: number;
}

export type PermissionMatrixEvent =
  | { type: 'COLLAPSE'; resource: string }
  | { type: 'EXPAND'; resource: string }
  | { type: 'CHANGE' }
  | { type: 'SAVE' }
  | { type: 'SAVE_COMPLETE' }
  | { type: 'DISCARD' }
  | { type: 'NAVIGATE'; row: number; col: number };

export function permissionMatrixReducer(
  state: PermissionMatrixState,
  event: PermissionMatrixEvent,
): PermissionMatrixState {
  switch (event.type) {
    case 'COLLAPSE': {
      const s = new Set(state.collapsedGroups);
      s.add(event.resource);
      return { ...state, collapsedGroups: s };
    }
    case 'EXPAND': {
      const s = new Set(state.collapsedGroups);
      s.delete(event.resource);
      return { ...state, collapsedGroups: s };
    }
    case 'CHANGE':
      return { ...state, saving: 'pending' };
    case 'SAVE':
      return { ...state, saving: 'saving' };
    case 'SAVE_COMPLETE':
      return { ...state, saving: 'idle' };
    case 'DISCARD':
      return { ...state, saving: 'idle' };
    case 'NAVIGATE':
      return { ...state, focusRow: event.row, focusCol: event.col };
    default:
      return state;
  }
}

export function isGranted(
  permissions: PermissionMap,
  resource: string,
  action: string,
  role: string,
): boolean {
  return permissions[resource]?.[action]?.includes(role) ?? false;
}

export function allActionsGranted(
  permissions: PermissionMap,
  resource: ResourceDef,
  roleKey: string,
): boolean {
  return resource.actions.every((a) => isGranted(permissions, resource.key, a.key, roleKey));
}

export function someActionsGranted(
  permissions: PermissionMap,
  resource: ResourceDef,
  roleKey: string,
): boolean {
  return resource.actions.some((a) => isGranted(permissions, resource.key, a.key, roleKey));
}

export function allGranted(
  permissions: PermissionMap,
  resources: ResourceDef[],
  roleKey: string,
): boolean {
  return resources.every((r) => allActionsGranted(permissions, r, roleKey));
}

export function someGranted(
  permissions: PermissionMap,
  resources: ResourceDef[],
  roleKey: string,
): boolean {
  return resources.some((r) => someActionsGranted(permissions, r, roleKey));
}
