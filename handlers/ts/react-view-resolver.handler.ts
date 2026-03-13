// ReactViewResolver Provider Handler
//
// Client-side View data resolver for React environments. Like
// KernelViewResolver, does not need kernel access — syncs handle
// cross-concept invocation. This provider is selected when the
// context specifies resolver_type: "react".

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let registered = false;

export const reactViewResolverHandler: ConceptHandler = {
  async register(_input: Record<string, unknown>, storage: ConceptStorage) {
    if (registered) {
      return { variant: 'already_registered' };
    }

    registered = true;
    await storage.put('react-view-resolver', '__registered', { value: true });

    return { variant: 'ok', provider_name: 'react' };
  },

  async resolve(input: Record<string, unknown>, _storage: ConceptStorage) {
    const view = input.view as string;
    const dataSource = input.data_source as string;
    const filters = input.filters as string;
    const context = input.context as string;

    if (!dataSource) {
      return { variant: 'invalid_source', message: 'data_source is required' };
    }

    // Validate dataSource JSON
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(dataSource);
    } catch {
      return { variant: 'invalid_source', message: `Invalid data_source JSON: ${dataSource}` };
    }

    if (!parsed.concept || !parsed.action) {
      return {
        variant: 'invalid_source',
        message: 'data_source must contain concept and action fields',
      };
    }

    // Return ok — the sync chain dispatches to the concept/action.
    // For React, the API layer bridges the result back to the component.
    return {
      variant: 'ok',
      data_source: dataSource,
      view,
      filters: filters || '[]',
      context: context || '{}',
    };
  },
};

/** Reset internal state for testing. */
export function resetReactViewResolver(): void {
  registered = false;
}
