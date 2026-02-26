// ============================================================
// Slot Concept Implementation
//
// Named insertion points for composition. Defines slots within
// components that can be filled with content, cleared, or
// given default content for flexible UI composition.
// Relation: 'slot' keyed by slot (L).
// ============================================================

import type { ConceptHandler } from '../../../kernel/src/types.js';

export const slotHandler: ConceptHandler = {
  async define(input, storage) {
    const slot = input.slot as string;
    const name = input.name as string;
    const component = input.component as string;

    // Validate required fields
    if (!name || !component) {
      return { variant: 'invalid', message: 'Slot requires both name and component' };
    }

    await storage.put('slot', slot, {
      slot,
      name,
      component,
      defaultContent: '',
      scope: '',
      filled: false,
    });

    return { variant: 'ok', slot };
  },

  async fill(input, storage) {
    const slot = input.slot as string;
    const content = input.content as string;

    const record = await storage.get('slot', slot);
    if (!record) {
      return { variant: 'notfound', message: `Slot "${slot}" not found` };
    }

    await storage.put('slot', slot, {
      ...record,
      defaultContent: content,
      filled: true,
    });

    return { variant: 'ok', slot };
  },

  async setDefault(input, storage) {
    const slot = input.slot as string;
    const defaultContent = input.defaultContent as string;

    const record = await storage.get('slot', slot);
    if (!record) {
      return { variant: 'notfound', message: `Slot "${slot}" not found` };
    }

    await storage.put('slot', slot, {
      ...record,
      defaultContent,
    });

    return { variant: 'ok', slot };
  },

  async clear(input, storage) {
    const slot = input.slot as string;

    const record = await storage.get('slot', slot);
    if (!record) {
      return { variant: 'notfound', message: `Slot "${slot}" not found` };
    }

    await storage.put('slot', slot, {
      ...record,
      defaultContent: '',
      filled: false,
    });

    return { variant: 'ok', slot };
  },
};
