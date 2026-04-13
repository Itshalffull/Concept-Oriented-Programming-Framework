// @clef-handler style=functional
// KeybindingPreset Concept Handler — Functional (StorageProgram) style
//
// Manages named keybinding preset packs. Each preset bundles a set of
// KeyBinding id → chord-override pairs. Tracks which preset is active
// per user. Actual override application/revocation is handled by syncs.
//
// Storage keys:
//   preset:<P>   → { name, description, entries: Array<{binding,chord}> }
//   active:<U>   → { preset: P | null }

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram,
  get,
  put,
  putFrom,
  branch,
  complete,
  completeFrom,
  mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

// ── register (concept action) ────────────────────────────────────────────────
function registerPreset(input: Record<string, unknown>): StorageProgram<Result> {
  const preset = input.preset as string;
  const name = input.name as string;
  const description = input.description as string;

  if (!name || name.trim() === '') {
    const p = createProgram();
    return complete(p, 'error', { message: 'name is required' }) as StorageProgram<Result>;
  }

  let p = createProgram();
  p = get(p, 'preset', preset, 'existing');
  p = branch(
    p,
    'existing',
    (b) => complete(b, 'duplicate', { message: `Preset "${preset}" is already registered.` }),
    (b) => {
      const q = put(b, 'preset', preset, { name, description, entries: [] });
      return complete(q, 'ok', { preset });
    },
  );
  return p as StorageProgram<Result>;
}

// ── addBinding ───────────────────────────────────────────────────────────────
function addBinding(input: Record<string, unknown>): StorageProgram<Result> {
  const preset = input.preset as string;
  const binding = input.binding as string;
  const chord = input.chord as unknown[];

  // Validate chord is non-empty
  if (!Array.isArray(chord) || chord.length === 0) {
    const p = createProgram();
    return complete(p, 'duplicate_binding', {
      message: 'Chord must contain at least one keystroke.',
    }) as StorageProgram<Result>;
  }

  let p = createProgram();
  p = get(p, 'preset', preset, 'presetRec');
  p = branch(
    p,
    'presetRec',
    (b) => {
      // Preset exists — enrich bindings with computed update info
      let q = mapBindings(
        b,
        (bindings) => {
          const rec = bindings.presetRec as Record<string, unknown>;
          const entries = rec.entries as Array<{ binding: string; chord: unknown[] }>;
          const already = entries.some((e) => e.binding === binding);
          return {
            isDuplicate: already,
            newEntries: already ? entries : [...entries, { binding, chord }],
            rec,
          };
        },
        'updateInfo',
      );
      // Write new entries to storage if not duplicate
      q = putFrom(q, 'preset', preset, (bindings) => {
        const info = bindings.updateInfo as {
          isDuplicate: boolean;
          newEntries: Array<{ binding: string; chord: unknown[] }>;
          rec: Record<string, unknown>;
        };
        if (info.isDuplicate) {
          // Return the original record unchanged — the branch below will
          // return duplicate_binding without using this written value.
          return info.rec;
        }
        return { ...info.rec, entries: info.newEntries };
      });
      return completeFrom(q, 'ok', (bindings) => {
        const info = bindings.updateInfo as { isDuplicate: boolean };
        if (info.isDuplicate) {
          return {
            variant: 'duplicate_binding',
            message: `Binding "${binding}" already exists in preset "${preset}".`,
          };
        }
        return { variant: 'ok' };
      });
    },
    (b) =>
      complete(b, 'preset_not_found', {
        message: `No preset with id "${preset}" is registered.`,
      }),
  );
  return p as StorageProgram<Result>;
}

// ── removeBinding ────────────────────────────────────────────────────────────
function removeBinding(input: Record<string, unknown>): StorageProgram<Result> {
  const preset = input.preset as string;
  const binding = input.binding as string;

  let p = createProgram();
  p = get(p, 'preset', preset, 'presetRec');
  p = branch(
    p,
    'presetRec',
    (b) => {
      let q = mapBindings(
        b,
        (bindings) => {
          const rec = bindings.presetRec as Record<string, unknown>;
          const entries = rec.entries as Array<{ binding: string; chord: unknown[] }>;
          const idx = entries.findIndex((e) => e.binding === binding);
          return {
            notFound: idx === -1,
            newEntries: idx === -1 ? entries : entries.filter((_, i) => i !== idx),
            rec,
          };
        },
        'removeInfo',
      );
      // Write updated entries (only actually useful when not notFound)
      q = putFrom(q, 'preset', preset, (bindings) => {
        const info = bindings.removeInfo as {
          notFound: boolean;
          newEntries: Array<{ binding: string; chord: unknown[] }>;
          rec: Record<string, unknown>;
        };
        if (info.notFound) return info.rec; // no-op write
        return { ...info.rec, entries: info.newEntries };
      });
      return completeFrom(q, 'ok', (bindings) => {
        const info = bindings.removeInfo as { notFound: boolean };
        if (info.notFound) {
          return {
            variant: 'binding_not_in_preset',
            message: `Binding "${binding}" is not in preset "${preset}".`,
          };
        }
        return { variant: 'ok' };
      });
    },
    (b) =>
      complete(b, 'preset_not_found', {
        message: `No preset with id "${preset}" is registered.`,
      }),
  );
  return p as StorageProgram<Result>;
}

// ── listBindings ─────────────────────────────────────────────────────────────
function listBindings(input: Record<string, unknown>): StorageProgram<Result> {
  const preset = input.preset as string;

  let p = createProgram();
  p = get(p, 'preset', preset, 'presetRec');
  p = branch(
    p,
    'presetRec',
    (b) =>
      completeFrom(b, 'ok', (bindings) => {
        const rec = bindings.presetRec as Record<string, unknown>;
        return { bindings: rec.entries };
      }),
    (b) =>
      complete(b, 'preset_not_found', {
        message: `No preset with id "${preset}" is registered.`,
      }),
  );
  return p as StorageProgram<Result>;
}

// ── activate ─────────────────────────────────────────────────────────────────
function activate(input: Record<string, unknown>): StorageProgram<Result> {
  const user = input.user as string;
  const preset = input.preset as string;

  let p = createProgram();
  p = get(p, 'preset', preset, 'presetRec');
  p = branch(
    p,
    'presetRec',
    (b) => {
      const q = put(b, 'active', user, { preset });
      return complete(q, 'ok', {});
    },
    (b) =>
      complete(b, 'preset_not_found', {
        message: `No preset with id "${preset}" is registered.`,
      }),
  );
  return p as StorageProgram<Result>;
}

// ── deactivate ────────────────────────────────────────────────────────────────
function deactivate(input: Record<string, unknown>): StorageProgram<Result> {
  const user = input.user as string;

  let p = createProgram();
  p = get(p, 'active', user, 'activeRec');
  p = branch(
    p,
    'activeRec',
    (b) => {
      const q = put(b, 'active', user, { preset: null });
      return complete(q, 'ok', {});
    },
    (b) =>
      complete(b, 'not_active', {
        message: `User "${user}" has no active preset.`,
      }),
  );
  return p as StorageProgram<Result>;
}

// ── getActive ─────────────────────────────────────────────────────────────────
function getActive(input: Record<string, unknown>): StorageProgram<Result> {
  const user = input.user as string;

  let p = createProgram();
  p = get(p, 'active', user, 'activeRec');
  return completeFrom(p, 'ok', (bindings) => {
    const rec = bindings.activeRec as Record<string, unknown> | null;
    return { preset: rec ? rec.preset : null };
  }) as StorageProgram<Result>;
}

// ── Handler export ────────────────────────────────────────────────────────────
const _handler: FunctionalConceptHandler = {
  // PluginRegistry discovery — returns { name: 'KeybindingPreset' }.
  // The concept also has a 'register' action; the test generator resolves
  // this handler by file-name kebab-case fallback when there is ambiguity.
  register(input: Record<string, unknown>) {
    // When called with no preset/name (PluginRegistry probe), return name.
    if (!input || (!input.preset && !input.name)) {
      return { variant: 'ok', name: 'KeybindingPreset' } as unknown as StorageProgram<Result>;
    }
    // Otherwise delegate to the concept's register action.
    return registerPreset(input);
  },
  addBinding,
  removeBinding,
  listBindings,
  activate,
  deactivate,
  getActive,
};

export const keybindingPresetHandler = autoInterpret(_handler);
export default keybindingPresetHandler;
