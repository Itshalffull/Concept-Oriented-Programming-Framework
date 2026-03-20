// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Theme Concept Implementation [H]
// Named themes with inheritance, activation priority, and token resolution.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, putFrom, branch, complete, completeFrom, mapBindings, traverse,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }

const _themeHandler: FunctionalConceptHandler = {
  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'theme', {}, 'items');
    p = mapBindings(p, (bindings) => JSON.stringify((bindings.items as Array<Record<string, unknown>>) || []), 'itemsJson');
    return complete(p, 'ok', { items: '' }) as StorageProgram<Result>;
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
    return p as StorageProgram<Result>;
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
    return p as StorageProgram<Result>;
  },

  activate(input: Record<string, unknown>) {
    const theme = input.theme as string;
    const priority = input.priority as number;

    let p = createProgram();
    p = spGet(p, 'theme', theme, 'existing');
    p = branch(p, 'existing',
      (b) => {
        // Deactivate all other themes using traverse
        let b2 = find(b, 'theme', {}, 'allThemes');
        b2 = traverse(b2, 'allThemes', '_themeItem', (item) => {
          const t = item as Record<string, unknown>;
          let sub = createProgram();
          if ((t.id as string) !== theme && t.active) {
            sub = put(sub, 'theme', t.id as string, { ...t, active: false });
            return complete(sub, 'deactivated', {});
          }
          return complete(sub, 'skipped', {});
        }, '_deactivateResults', { writes: ['theme'], completionVariants: ['deactivated', 'skipped'] });

        // Activate the target theme
        b2 = putFrom(b2, 'theme', theme, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return { ...existing, active: true, priority: priority ?? Number(existing.priority ?? 0) };
        });
        return complete(b2, 'ok', { theme });
      },
      (b) => complete(b, 'notfound', { message: `Theme "${theme}" not found` }),
    );
    return p as StorageProgram<Result>;
  },

  deactivate(input: Record<string, unknown>) {
    const theme = input.theme as string;

    let p = createProgram();
    p = spGet(p, 'theme', theme, 'existing');
    p = branch(p, 'existing',
      (b) => {
        // Deactivate the target theme
        let b2 = putFrom(b, 'theme', theme, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return { ...existing, active: false };
        });

        // Find all themes and use traverse to activate the first fallback
        b2 = find(b2, 'theme', {}, 'allThemes');

        // Determine which theme (if any) should become the fallback
        b2 = mapBindings(b2, (bindings) => {
          const allThemes = (bindings.allThemes as Array<Record<string, unknown>>) || [];
          const fallback = allThemes.find((t: any) => (t.id as string) !== theme);
          return fallback ? (fallback.id as string) : null;
        }, '_fallbackId');

        // Use traverse to activate the fallback theme (put with dynamic key)
        b2 = traverse(b2, 'allThemes', '_tItem', (item, bindings) => {
          const t = item as Record<string, unknown>;
          const fallbackId = bindings._fallbackId as string | null;
          let sub = createProgram();
          if (fallbackId && (t.id as string) === fallbackId && !t.active) {
            sub = put(sub, 'theme', t.id as string, { ...t, active: true });
            return complete(sub, 'activated', { theme: t.id });
          }
          return complete(sub, 'skipped', {});
        }, '_fallbackResults', { writes: ['theme'], completionVariants: ['activated', 'skipped'] });

        return completeFrom(b2, 'ok', (bindings) => {
          const fallbackId = bindings._fallbackId as string | null;
          return { theme: fallbackId || theme };
        });
      },
      (b) => complete(b, 'notfound', { message: `Theme "${theme}" not found` }),
    );
    return p as StorageProgram<Result>;
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
    return p as StorageProgram<Result>;
  },
};

// All actions are now fully functional — no imperative overrides needed.
export const themeHandler = autoInterpret(_themeHandler);
