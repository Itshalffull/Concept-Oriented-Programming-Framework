// @migrated dsl-constructs 2026-03-18
// KernelViewResolver Provider Handler
//
// Server-side View data resolver. Parses the view's dataSource JSON
// and returns target_concept and target_action as output fields.
// The sync engine dispatches to the actual concept/action via
// KernelResolverFetchesData sync (?concept/?action in then-clause),
// and ViewResolveTracksItems sync matches the completion via
// ?concept/?action in its when-clause.
//
// This handler does NOT need kernel access — all cross-concept
// dispatch goes through syncs.

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, put, complete,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

let registered = false;

type Result = { variant: string; [key: string]: unknown };

const _kernelViewResolverHandler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    if (registered) {
      return complete(createProgram(), 'already_registered', {}) as StorageProgram<Result>;
    }

    registered = true;
    let p = createProgram();
    p = put(p, 'kernel-view-resolver', '__registered', { value: true });
    return complete(p, 'ok', { provider_name: 'kernel' }) as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const view = input.view as string;
    const dataSource = input.data_source as string;
    const filters = input.filters as string;

    if (!dataSource) {
      return complete(createProgram(), 'invalid_source', { message: 'data_source is required' }) as StorageProgram<Result>;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(dataSource);
    } catch {
      return complete(createProgram(), 'invalid_source', { message: `Invalid data_source JSON: ${dataSource}` }) as StorageProgram<Result>;
    }

    const concept = parsed.concept as string;
    const action = parsed.action as string;

    if (!concept || !action) {
      return complete(createProgram(), 'invalid_source', {
        message: 'data_source must contain concept and action fields',
      }) as StorageProgram<Result>;
    }

    // Return target concept/action as output fields for sync dispatch.
    // KernelResolverFetchesData sync will pick these up and dispatch
    // ?concept/?action dynamically.
    const p = createProgram();
    return complete(p, 'ok', {
      view,
      target_concept: `urn:clef/${concept}`,
      target_action: action,
      filters: filters || '[]',
    }) as StorageProgram<Result>;
  },
};

export const kernelViewResolverHandler = autoInterpret(_kernelViewResolverHandler);

/** Reset internal state for testing. */
export function resetKernelViewResolver(): void {
  registered = false;
}
