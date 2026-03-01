// Slot Concept Implementation
// Named insertion points within host components for composable content projection.
import type { ConceptHandler } from '@clef/runtime';

let slotCounter = 0;

export const slotHandler: ConceptHandler = {
  async define(input, storage) {
    const slot = input.slot as string;
    const name = input.name as string;
    const host = input.host as string;
    const position = input.position as string;
    const fallback = input.fallback as string;

    const existing = await storage.get('slot', slot);
    if (existing) {
      return { variant: 'duplicate', message: 'A slot with this identity already exists' };
    }

    slotCounter++;

    await storage.put('slot', slot, {
      slot,
      name: name || `slot-${slotCounter}`,
      host,
      content: '',
      position: position || 'default',
      fallback: fallback || '',
      createdAt: new Date().toISOString(),
    });

    return { variant: 'ok' };
  },

  async fill(input, storage) {
    const slot = input.slot as string;
    const content = input.content as string;

    const existing = await storage.get('slot', slot);
    if (!existing) {
      return { variant: 'notfound', message: 'Slot not found' };
    }

    await storage.put('slot', slot, {
      ...existing,
      content,
    });

    return { variant: 'ok' };
  },

  async clear(input, storage) {
    const slot = input.slot as string;

    const existing = await storage.get('slot', slot);
    if (!existing) {
      return { variant: 'notfound', message: 'Slot not found' };
    }

    await storage.put('slot', slot, {
      ...existing,
      content: '',
    });

    return { variant: 'ok' };
  },
};
