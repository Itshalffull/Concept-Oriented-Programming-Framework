/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export interface TreeNode {
  id: string;
  label: string;
  children?: TreeNode[];
  disabled?: boolean;
}

/* ---------------------------------------------------------------------------
 * State machine
 * Item expand: collapsed (initial) -> expanded
 * Selection: unchecked (initial) -> checked -> indeterminate
 * Focus: idle (initial) -> focused
 * Events: TOGGLE, CHECK, UNCHECK, FOCUS_ITEM, BLUR, navigation events
 * ------------------------------------------------------------------------- */

export interface TreeMachine {
  expandedIds: Set<string>;
  checkedIds: Set<string>;
  focusedId: string | null;
}

export type TreeEvent =
  | { type: 'TOGGLE'; itemId: string }
  | { type: 'CHECK'; itemId: string }
  | { type: 'UNCHECK'; itemId: string }
  | { type: 'TOGGLE_CHECK'; itemId: string }
  | { type: 'FOCUS_ITEM'; itemId: string }
  | { type: 'BLUR' }
  | { type: 'EXPAND'; itemId: string }
  | { type: 'COLLAPSE'; itemId: string }
  | { type: 'EXPAND_ALL_SIBLINGS'; itemId: string };

export function getAllDescendantIds(node: TreeNode): string[] {
  const ids: string[] = [];
  for (const child of node.children ?? []) {
    ids.push(child.id);
    ids.push(...getAllDescendantIds(child));
  }
  return ids;
}

export function findNode(items: TreeNode[], id: string): TreeNode | null {
  for (const item of items) {
    if (item.id === id) return item;
    if (item.children) {
      const found = findNode(item.children, id);
      if (found) return found;
    }
  }
  return null;
}

export function treeReducer(state: TreeMachine, event: TreeEvent): TreeMachine {
  const s: TreeMachine = {
    expandedIds: new Set(state.expandedIds),
    checkedIds: new Set(state.checkedIds),
    focusedId: state.focusedId,
  };

  switch (event.type) {
    case 'TOGGLE':
      if (s.expandedIds.has(event.itemId)) s.expandedIds.delete(event.itemId);
      else s.expandedIds.add(event.itemId);
      break;
    case 'EXPAND':
      s.expandedIds.add(event.itemId);
      break;
    case 'COLLAPSE':
      s.expandedIds.delete(event.itemId);
      break;
    case 'CHECK':
      s.checkedIds.add(event.itemId);
      break;
    case 'UNCHECK':
      s.checkedIds.delete(event.itemId);
      break;
    case 'TOGGLE_CHECK':
      if (s.checkedIds.has(event.itemId)) s.checkedIds.delete(event.itemId);
      else s.checkedIds.add(event.itemId);
      break;
    case 'FOCUS_ITEM':
      s.focusedId = event.itemId;
      break;
    case 'BLUR':
      break;
    case 'EXPAND_ALL_SIBLINGS':
      // Handled by the component
      break;
  }

  return s;
}
