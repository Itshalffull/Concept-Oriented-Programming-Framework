// ============================================================
// Theme Concept Implementation
//
// Compose tokens into visual language. Themes hold named sets of
// design-token overrides that can be layered via a base-chain and
// activated with priority ordering.
// Relation: 'theme' keyed by H.
// ============================================================

import type { ConceptHandler } from '../../../runtime/types.js';

export const themeHandler: ConceptHandler = {
  async create(input, storage) {
    const theme = input.theme as string;
    const name = input.name as string;
    const overrides = input.overrides as string;

    // Check name uniqueness across all registered themes
    const existing = await storage.find('theme', { name });
    if (existing.length > 0) {
      return { variant: 'duplicate', message: `Theme with name "${name}" already exists` };
    }

    await storage.put('theme', theme, {
      theme,
      name,
      base: '',
      overrides,
      active: false,
      priority: 0,
    });

    return { variant: 'ok', theme };
  },

  async extend(input, storage) {
    const theme = input.theme as string;
    const base = input.base as string;
    const overrides = input.overrides as string;

    // Check that the base theme exists
    const baseTheme = await storage.get('theme', base);
    if (!baseTheme) {
      return { variant: 'notfound', message: `Base theme "${base}" not found` };
    }

    // Retrieve current theme or create a new entry extending base
    const existing = await storage.get('theme', theme);
    const name = existing ? (existing.name as string) : '';

    await storage.put('theme', theme, {
      theme,
      name,
      base,
      overrides,
      active: existing ? (existing.active as boolean) : false,
      priority: existing ? (existing.priority as number) : 0,
    });

    return { variant: 'ok', theme };
  },

  async activate(input, storage) {
    const theme = input.theme as string;
    const priority = input.priority as number;

    const existing = await storage.get('theme', theme);
    if (!existing) {
      return { variant: 'notfound', message: `Theme "${theme}" not found` };
    }

    await storage.put('theme', theme, {
      ...existing,
      active: true,
      priority,
    });

    return { variant: 'ok', theme };
  },

  async deactivate(input, storage) {
    const theme = input.theme as string;

    const existing = await storage.get('theme', theme);
    if (!existing) {
      return { variant: 'notfound', message: `Theme "${theme}" not found` };
    }

    await storage.put('theme', theme, {
      ...existing,
      active: false,
    });

    return { variant: 'ok', theme };
  },

  async resolve(input, storage) {
    const theme = input.theme as string;

    const record = await storage.get('theme', theme);
    if (!record) {
      return { variant: 'notfound', message: `Theme "${theme}" not found` };
    }

    // Walk the base chain collecting overrides from root to leaf
    const overrideStack: Record<string, unknown>[] = [];
    let current: Record<string, unknown> | null = record;

    const visited = new Set<string>();
    while (current) {
      const key = current.theme as string;
      if (visited.has(key)) break; // prevent cycles
      visited.add(key);

      try {
        const parsed = JSON.parse(current.overrides as string);
        overrideStack.unshift(parsed); // base overrides go first
      } catch {
        // skip unparseable overrides
      }

      const baseKey = current.base as string;
      if (baseKey) {
        current = await storage.get('theme', baseKey);
      } else {
        current = null;
      }
    }

    // Merge overrides: base first, then each descendant
    const merged: Record<string, unknown> = {};
    for (const layer of overrideStack) {
      Object.assign(merged, layer);
    }

    const tokens = JSON.stringify(merged);
    return { variant: 'ok', tokens };
  },
};
