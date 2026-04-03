// @clef-handler style=functional concept=InteractionSpec
// ============================================================
// InteractionSpec Concept Implementation — Functional (StorageProgram) style
//
// Manages named interaction configurations that govern controls, row actions,
// navigation, and picker behaviors for a view. Supports create, get, and list.
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
    return complete(p, 'ok', { name: 'InteractionSpec' }) as StorageProgram<Result>;
  },

  create(input: Record<string, unknown>) {
    const name = input.name as string;
    const createForm = (input.createForm ?? '') as string;
    const rowClick = (input.rowClick ?? '') as string;
    const rowActions = (input.rowActions ?? '[]') as string;
    const pickerMode = (input.pickerMode ?? false) as boolean;

    if (!name || name.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'name is required',
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'interaction', name, 'existing');

    return branch(
      p,
      'existing',
      // existing != null — duplicate
      (b) =>
        completeFrom(b, 'duplicate', (bindings) => ({
          interaction: (bindings.existing as Record<string, unknown>).name as string,
        })),
      // existing == null — store and return ok
      (b) => {
        const b2 = put(b, 'interaction', name, {
          name,
          createForm,
          rowClick,
          rowActions,
          pickerMode,
        });
        return complete(b2, 'ok', { interaction: name });
      },
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const name = input.name as string;

    let p = createProgram();
    p = get(p, 'interaction', name, 'existing');

    return branch(
      p,
      'existing',
      (b) =>
        completeFrom(b, 'ok', (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return {
            interaction: existing.name as string,
            createForm: existing.createForm as string,
            rowClick: existing.rowClick as string,
            rowActions: existing.rowActions as string,
            pickerMode: existing.pickerMode as boolean,
          };
        }),
      (b) =>
        complete(b, 'notfound', {
          message: `No interaction spec with name "${name}" found`,
        }),
    ) as StorageProgram<Result>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'interaction', {}, 'allInteractions');
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.allInteractions as Array<Record<string, unknown>>) ?? [];
      const interactions = all.map((i) => ({
        name: i.name,
        createForm: i.createForm,
        rowClick: i.rowClick,
        rowActions: i.rowActions,
        pickerMode: i.pickerMode,
      }));
      return { interactions: JSON.stringify(interactions) };
    }) as StorageProgram<Result>;
  },
};

export const interactionSpecHandler = autoInterpret(_handler);
