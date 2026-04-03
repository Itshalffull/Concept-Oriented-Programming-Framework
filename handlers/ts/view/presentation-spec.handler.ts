// @clef-handler style=functional concept=PresentationSpec
// ============================================================
// PresentationSpec Concept Implementation — Functional (StorageProgram) style
//
// Manages named display strategies carrying a display type, opaque JSON hints,
// a display-mode policy, and a default display mode for rendering views.
//
// Actions: create, get, list
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram,
  get,
  find,
  put,
  complete,
  completeFrom,
  branch,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _handler: FunctionalConceptHandler = {

  register(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', { name: 'PresentationSpec' }) as StorageProgram<Result>;
  },

  create(input: Record<string, unknown>) {
    const name = input.name as string;
    const displayType = input.displayType as string;
    const hints = input.hints as string;
    const displayModePolicy = input.displayModePolicy as string;
    const defaultDisplayMode = input.defaultDisplayMode as string;

    if (!name || name.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'name is required',
      }) as StorageProgram<Result>;
    }

    if (!displayType || displayType.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'displayType is required',
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'presentation', name, 'existing');

    return branch(
      p,
      'existing',
      // existing != null — duplicate
      (b) =>
        completeFrom(b, 'duplicate', (bindings) => ({
          presentation: (bindings.existing as Record<string, unknown>).name as string,
        })),
      // existing == null — store and return ok
      (b) => {
        const b2 = put(b, 'presentation', name, {
          name,
          displayType,
          hints,
          displayModePolicy,
          defaultDisplayMode,
        });
        return complete(b2, 'ok', { presentation: name });
      },
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const name = input.name as string;

    let p = createProgram();
    p = get(p, 'presentation', name, 'existing');

    return branch(
      p,
      'existing',
      (b) =>
        completeFrom(b, 'ok', (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return {
            presentation: existing.name as string,
            displayType: existing.displayType as string,
            hints: existing.hints as string,
            displayModePolicy: existing.displayModePolicy as string,
            defaultDisplayMode: existing.defaultDisplayMode as string,
          };
        }),
      (b) =>
        complete(b, 'notfound', {
          message: `No presentation with name "${name}" found`,
        }),
    ) as StorageProgram<Result>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'presentation', {}, 'allPresentations');
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.allPresentations as Array<Record<string, unknown>>) ?? [];
      return { presentations: JSON.stringify(all) };
    }) as StorageProgram<Result>;
  },
};

export const presentationSpecHandler = autoInterpret(_handler);
