// Theme Concept Implementation [H]
// Named themes with inheritance, activation priority, and token resolution.
import type { ConceptHandler } from '@clef/runtime';

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }

type ThemeRecord = Record<string, unknown>;

function themeKey(theme: ThemeRecord): string {
  return String(theme._key ?? theme.id ?? theme.theme ?? theme.name ?? '');
}

function isActive(theme: ThemeRecord): boolean {
  return theme.active === true || theme.status === 'active';
}

function sortThemes(themes: ThemeRecord[]): ThemeRecord[] {
  return [...themes].sort((left, right) => {
    const priorityDiff = Number(right.priority ?? 0) - Number(left.priority ?? 0);
    if (priorityDiff !== 0) return priorityDiff;
    return themeKey(left).localeCompare(themeKey(right));
  });
}

function pickFallbackTheme(themes: ThemeRecord[], excludeKey: string): ThemeRecord | null {
  const candidates = sortThemes(themes).filter((theme) => themeKey(theme) !== excludeKey);
  if (candidates.length === 0) return null;
  return (
    candidates.find((theme) => themeKey(theme) === 'light')
    ?? candidates[0]
    ?? null
  );
}

async function listThemes(storage: { find: (relation: string, criteria?: Record<string, unknown>) => Promise<Record<string, unknown>[]> }) {
  return await storage.find('theme', {});
}

async function saveTheme(
  storage: { put: (relation: string, key: string, value: Record<string, unknown>) => Promise<void> },
  key: string,
  value: ThemeRecord,
) {
  await storage.put('theme', key, { ...value, id: key });
}

async function activateSingleTheme(
  storage: {
    find: (relation: string, criteria?: Record<string, unknown>) => Promise<Record<string, unknown>[]>;
    put: (relation: string, key: string, value: Record<string, unknown>) => Promise<void>;
  },
  activeThemeKey: string,
  priority: number,
) {
  const themes = await listThemes(storage);
  for (const theme of themes) {
    const key = themeKey(theme);
    if (!key) continue;
    await saveTheme(storage, key, {
      ...theme,
      active: key === activeThemeKey,
      priority: key === activeThemeKey ? priority : Number(theme.priority ?? 0),
    });
  }
}

export const themeHandler: ConceptHandler = {
  async list(_input, storage) {
    const items = await storage.find('theme', {});
    return { variant: 'ok', items: JSON.stringify(items) };
  },

  async create(input, storage) {
    const theme = input.theme as string;
    const name = input.name as string;
    const overrides = input.overrides as string;

    const id = theme || nextId('H');
    const themes = await listThemes(storage);
    const shouldActivate = !themes.some((item) => isActive(item));

    const existing = await storage.get('theme', id);
    if (existing) {
      return { variant: 'duplicate', message: `Theme "${id}" already exists` };
    }

    await saveTheme(storage, id, {
      id,
      name,
      base: '',
      overrides: overrides || JSON.stringify({}),
      active: shouldActivate,
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
    const themes = await listThemes(storage);
    const shouldActivate = !themes.some((item) => isActive(item));

    // Merge base overrides with new overrides
    const baseOverrides: Record<string, unknown> = JSON.parse((baseTheme.overrides as string) || '{}');
    const newOverrides: Record<string, unknown> = overrides ? JSON.parse(overrides) : {};
    const merged = { ...baseOverrides, ...newOverrides };

    await saveTheme(storage, id, {
      id,
      name: `${baseTheme.name as string}-extended`,
      base,
      overrides: JSON.stringify(merged),
      active: shouldActivate,
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

    await activateSingleTheme(storage, theme, priority ?? Number(existing.priority ?? 0));

    return { variant: 'ok', theme };
  },

  async deactivate(input, storage) {
    const theme = input.theme as string;

    const existing = await storage.get('theme', theme);
    if (!existing) {
      return { variant: 'notfound', message: `Theme "${theme}" not found` };
    }

    if (!isActive(existing)) {
      return { variant: 'ok', theme };
    }

    const themes = await listThemes(storage);
    const fallback = pickFallbackTheme(themes, theme);

    if (!fallback) {
      await saveTheme(storage, theme, {
        ...existing,
        active: true,
      });
      return { variant: 'ok', theme };
    }

    await saveTheme(storage, theme, {
      ...existing,
      active: false,
    });
    await activateSingleTheme(storage, themeKey(fallback), Number(fallback.priority ?? 0));

    return { variant: 'ok', theme: themeKey(fallback) };
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
