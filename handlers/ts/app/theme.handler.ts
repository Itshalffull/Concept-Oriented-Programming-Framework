// Theme Concept Implementation [H]
// Named themes with inheritance, activation priority, and token resolution.
import type { ConceptHandler } from '@clef/runtime';

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }

export const themeHandler: ConceptHandler = {
  async create(input, storage) {
    const theme = input.theme as string;
    const name = input.name as string;
    const overrides = input.overrides as string;

    const id = theme || nextId('H');

    const existing = await storage.get('theme', id);
    if (existing) {
      return { variant: 'duplicate', message: `Theme "${id}" already exists` };
    }

    await storage.put('theme', id, {
      name,
      base: '',
      overrides: overrides || JSON.stringify({}),
      active: false,
      priority: 0,
    });

    return { variant: 'ok', theme: id };
  },

  async extend(input, storage) {
    const theme = input.theme as string;
    const base = input.base as string;
    const overrides = input.overrides as string;

    const baseTheme = await storage.get('theme', base);
    if (!baseTheme) {
      return { variant: 'notfound', message: `Base theme "${base}" not found` };
    }

    const id = theme || nextId('H');

    // Merge base overrides with new overrides
    const baseOverrides: Record<string, unknown> = JSON.parse((baseTheme.overrides as string) || '{}');
    const newOverrides: Record<string, unknown> = overrides ? JSON.parse(overrides) : {};
    const merged = { ...baseOverrides, ...newOverrides };

    await storage.put('theme', id, {
      name: `${baseTheme.name as string}-extended`,
      base,
      overrides: JSON.stringify(merged),
      active: false,
      priority: 0,
    });

    return { variant: 'ok', theme: id };
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
      priority: priority ?? 0,
    });

    return { variant: 'ok' };
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

    return { variant: 'ok' };
  },

  async resolve(input, storage) {
    const theme = input.theme as string;

    const existing = await storage.get('theme', theme);
    if (!existing) {
      return { variant: 'notfound', message: `Theme "${theme}" not found` };
    }

    // Collect tokens by walking the inheritance chain
    const allTokens: Record<string, unknown> = {};
    let current: string | null = theme;
    const visited = new Set<string>();

    while (current) {
      if (visited.has(current)) break;
      visited.add(current);

      const themeRecord = await storage.get('theme', current);
      if (!themeRecord) break;

      const overrides: Record<string, unknown> = JSON.parse((themeRecord.overrides as string) || '{}');
      // Base tokens are applied first, child overrides win
      for (const [key, value] of Object.entries(overrides)) {
        if (!(key in allTokens)) {
          allTokens[key] = value;
        }
      }

      current = (themeRecord.base as string) || null;
    }

    return {
      variant: 'ok',
      tokens: JSON.stringify(allTokens),
    };
  },
};
