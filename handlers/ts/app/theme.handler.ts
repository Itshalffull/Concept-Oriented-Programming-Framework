// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Theme Concept Implementation [H]
// Named themes with inheritance, activation priority, and token resolution.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, putFrom, branch, complete, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';
import type { ConceptStorage } from '../../../runtime/types.ts';

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }

const _themeHandler: FunctionalConceptHandler = {
  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'theme', {}, 'items');
    p = mapBindings(p, (bindings) => JSON.stringify((bindings.items as Array<Record<string, unknown>>) || []), 'itemsJson');
    return complete(p, 'ok', { items: '' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  create(input: Record<string, unknown>) {
    const theme = input.theme as string;
    const name = input.name as string;
    const overrides = input.overrides as string;
    const id = theme || nextId('H');
    let p = createProgram();
    p = spGet(p, 'theme', id, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'duplicate', { message: `Theme "${id}" already exists` }),
      (b) => {
        let b2 = find(b, 'theme', {}, 'allThemes');
        b2 = mapBindings(b2, (bindings) => {
          const themes = (bindings.allThemes as Array<Record<string, unknown>>) || [];
          return !themes.some((item) => item.active === true || item.status === 'active');
        }, 'shouldActivate');
        b2 = putFrom(b2, 'theme', id, (bindings) => {
          const shouldActivate = bindings.shouldActivate as boolean;
          return { id, name, base: '', overrides: overrides || JSON.stringify({}), active: shouldActivate, priority: 0 };
        });
        return complete(b2, 'ok', { theme: id });
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  extend(input: Record<string, unknown>) {
    const theme = input.theme as string;
    const base = input.base as string;
    const overrides = input.overrides as string;
    let p = createProgram();
    p = spGet(p, 'theme', base, 'baseTheme');
    p = branch(p, 'baseTheme',
      (b) => {
        const id = theme || nextId('H');
        let b2 = putFrom(b, 'theme', id, (bindings) => {
          const baseTheme = bindings.baseTheme as Record<string, unknown>;
          const baseOverrides: Record<string, unknown> = JSON.parse((baseTheme.overrides as string) || '{}');
          const newOverrides: Record<string, unknown> = overrides ? JSON.parse(overrides) : {};
          return { id, name: `${baseTheme.name as string}-extended`, base, overrides: JSON.stringify({ ...baseOverrides, ...newOverrides }), active: false, priority: 0 };
        });
        return complete(b2, 'ok', { theme: id });
      },
      (b) => complete(b, 'notfound', { message: `Base theme "${base}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  activate(input: Record<string, unknown>) {
    const theme = input.theme as string;
    const priority = input.priority as number;
    let p = createProgram();
    p = spGet(p, 'theme', theme, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'theme', theme, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return { ...existing, active: true, priority: priority ?? Number(existing.priority ?? 0) };
        });
        return complete(b2, 'ok', { theme });
      },
      (b) => complete(b, 'notfound', { message: `Theme "${theme}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  deactivate(input: Record<string, unknown>) {
    const theme = input.theme as string;
    let p = createProgram();
    p = spGet(p, 'theme', theme, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'theme', theme, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return { ...existing, active: false };
        });
        return complete(b2, 'ok', { theme });
      },
      (b) => complete(b, 'notfound', { message: `Theme "${theme}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  resolve(input: Record<string, unknown>) {
    const theme = input.theme as string;
    let p = createProgram();
    p = spGet(p, 'theme', theme, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const overrides: Record<string, unknown> = JSON.parse((existing.overrides as string) || '{}');
          return JSON.stringify(overrides);
        }, 'tokensJson');
        return complete(b2, 'ok', { tokens: '' });
      },
      (b) => complete(b, 'notfound', { message: `Theme "${theme}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

const _base = autoInterpret(_themeHandler);

// activate() needs to deactivate other themes, use imperative style.
async function _activate(input: Record<string, unknown>, storage: ConceptStorage) {
  const theme = input.theme as string;
  const priority = input.priority as number;
  const existing = await storage.get('theme', theme);
  if (!existing) {
    return { variant: 'notfound', message: `Theme "${theme}" not found` };
  }
  // Deactivate all other themes
  const allThemes = await storage.find('theme', {});
  for (const t of allThemes) {
    if ((t.id as string) !== theme && t.active) {
      await storage.put('theme', t.id as string, { ...t, active: false });
    }
  }
  await storage.put('theme', theme, { ...existing, active: true, priority: priority ?? Number(existing.priority ?? 0) });
  return { variant: 'ok', theme };
}

// deactivate() needs fallback activation which requires dynamic iteration, use imperative style.
async function _deactivate(input: Record<string, unknown>, storage: ConceptStorage) {
  const theme = input.theme as string;
  const existing = await storage.get('theme', theme);
  if (!existing) {
    return { variant: 'notfound', message: `Theme "${theme}" not found` };
  }
  await storage.put('theme', theme, { ...existing, active: false });

  // Find another theme to activate as fallback (pick the first one that isn't us)
  const allThemes = await storage.find('theme', {});
  // Re-read the updated list and find first inactive theme that isn't the one we deactivated
  const fallback = allThemes.find((t: any) => (t.id as string) !== theme);
  if (fallback) {
    const freshFallback = await storage.get('theme', fallback.id as string);
    if (freshFallback && !freshFallback.active) {
      await storage.put('theme', fallback.id as string, { ...freshFallback, active: true });
      return { variant: 'ok', theme: fallback.id as string };
    }
  }
  return { variant: 'ok', theme };
}

export const themeHandler = new Proxy(_base, {
  get(target, prop: string) {
    if (prop === 'activate') return _activate;
    if (prop === 'deactivate') return _deactivate;
    return (target as Record<string, unknown>)[prop];
  },
}) as typeof _base;

