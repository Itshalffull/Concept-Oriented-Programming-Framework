// ============================================================
// MenuSource Handler
//
// SlotSource provider that resolves a navigation menu tree.
// Registers with PluginRegistry under slot_source_provider.
// See Architecture doc Section 16.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `ms-${++idCounter}`;
}

let registered = false;

export const menuSourceHandler: ConceptHandler = {
  async register(_input: Record<string, unknown>, storage: ConceptStorage) {
    if (registered) {
      return { variant: 'already_registered' };
    }

    registered = true;
    await storage.put('menu-source', '__registered', { value: true });

    return { variant: 'ok', provider_name: 'menu' };
  },

  async resolve(input: Record<string, unknown>, storage: ConceptStorage) {
    const menuId = input.menu_id as string;
    const maxDepth = input.max_depth as number | undefined;
    const activePath = input.active_path as string | undefined;
    const context = input.context as string;

    if (!menuId) {
      return { variant: 'error', message: 'menu_id is required' };
    }

    // Parse context
    try {
      JSON.parse(context || '{}');
    } catch {
      return { variant: 'error', message: `Invalid context JSON: ${context}` };
    }

    // Look up the menu definition
    const menu = await storage.get('menu', menuId);
    if (!menu) {
      return { variant: 'menu_not_found', menu_id: menuId };
    }

    // Build the menu tree — in production this loads the full menu
    // definition, prunes to max_depth, and annotates active state
    const depth = maxDepth ?? 3;

    // Load menu items
    const items = await storage.find('menu_item', { menu_id: menuId });

    // Annotate active path
    const annotatedItems = items.map((item: Record<string, unknown>) => ({
      ...item,
      active: activePath ? String(item.path || '') === activePath : false,
    }));

    // Prune by depth
    const prunedItems = annotatedItems.filter(
      (item: Record<string, unknown>) => (Number(item.depth) || 0) <= depth,
    );

    const data = JSON.stringify({
      menu_id: menuId,
      max_depth: depth,
      active_path: activePath || null,
      items: prunedItems,
    });

    const id = nextId();
    await storage.put('menu-source', id, {
      id,
      menu_id: menuId,
      max_depth: depth,
      active_path: activePath || null,
      createdAt: new Date().toISOString(),
    });

    return { variant: 'ok', data };
  },
};

/** Reset internal state. Useful for testing. */
export function resetMenuSource(): void {
  idCounter = 0;
  registered = false;
}
