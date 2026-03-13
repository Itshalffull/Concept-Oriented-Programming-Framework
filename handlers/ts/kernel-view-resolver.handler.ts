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

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let registered = false;

export const kernelViewResolverHandler: ConceptHandler = {
  async register(_input: Record<string, unknown>, storage: ConceptStorage) {
    if (registered) {
      return { variant: 'already_registered' };
    }

    registered = true;
    await storage.put('kernel-view-resolver', '__registered', { value: true });

    return { variant: 'ok', provider_name: 'kernel' };
  },

  async resolve(input: Record<string, unknown>, _storage: ConceptStorage) {
    const view = input.view as string;
    const dataSource = input.data_source as string;
    const filters = input.filters as string;

    if (!dataSource) {
      return { variant: 'invalid_source', message: 'data_source is required' };
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(dataSource);
    } catch {
      return { variant: 'invalid_source', message: `Invalid data_source JSON: ${dataSource}` };
    }

    const concept = parsed.concept as string;
    const action = parsed.action as string;

    if (!concept || !action) {
      return {
        variant: 'invalid_source',
        message: 'data_source must contain concept and action fields',
      };
    }

    // Return target concept/action as output fields for sync dispatch.
    // KernelResolverFetchesData sync will pick these up and dispatch
    // ?concept/?action dynamically.
    return {
      variant: 'ok',
      view,
      target_concept: `urn:clef/${concept}`,
      target_action: action,
      filters: filters || '[]',
    };
  },
};

/** Reset internal state for testing. */
export function resetKernelViewResolver(): void {
  registered = false;
}
