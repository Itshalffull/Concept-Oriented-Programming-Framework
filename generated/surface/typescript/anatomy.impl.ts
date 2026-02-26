// ============================================================
// Anatomy Concept Implementation
//
// Named parts contract. Defines the structural decomposition
// of a UI component into named parts and slots, supporting
// extension for component composition.
// Relation: 'anatomy' keyed by anatomy (N).
// ============================================================

import type { ConceptHandler } from '../../../runtime/types.js';

export const anatomyHandler: ConceptHandler = {
  async define(input, storage) {
    const anatomy = input.anatomy as string;
    const component = input.component as string;
    const parts = input.parts as string;
    const slots = input.slots as string;

    // Check component uniqueness across all defined anatomies
    const existing = await storage.find('anatomy', { component });
    if (existing.length > 0) {
      return { variant: 'duplicate', message: `Anatomy for component "${component}" already defined` };
    }

    await storage.put('anatomy', anatomy, {
      anatomy,
      component,
      parts,
      slots,
      description: '',
    });

    return { variant: 'ok', anatomy };
  },

  async getParts(input, storage) {
    const anatomy = input.anatomy as string;

    const record = await storage.get('anatomy', anatomy);
    if (!record) {
      return { variant: 'notfound', message: `Anatomy "${anatomy}" not found` };
    }

    return { variant: 'ok', parts: record.parts as string };
  },

  async getSlots(input, storage) {
    const anatomy = input.anatomy as string;

    const record = await storage.get('anatomy', anatomy);
    if (!record) {
      return { variant: 'notfound', message: `Anatomy "${anatomy}" not found` };
    }

    return { variant: 'ok', slots: record.slots as string };
  },

  async extend(input, storage) {
    const anatomy = input.anatomy as string;
    const additionalParts = input.additionalParts as string;

    const record = await storage.get('anatomy', anatomy);
    if (!record) {
      return { variant: 'notfound', message: `Anatomy "${anatomy}" not found` };
    }

    // Merge the existing parts array with the additional parts
    let existingParts: string[];
    try {
      existingParts = JSON.parse(record.parts as string) as string[];
    } catch {
      existingParts = [];
    }

    let newParts: string[];
    try {
      newParts = JSON.parse(additionalParts) as string[];
    } catch {
      newParts = [];
    }

    // Combine arrays, avoiding duplicates
    const merged = [...existingParts];
    for (const part of newParts) {
      if (!merged.includes(part)) {
        merged.push(part);
      }
    }

    await storage.put('anatomy', anatomy, {
      ...record,
      parts: JSON.stringify(merged),
    });

    return { variant: 'ok', anatomy };
  },
};
