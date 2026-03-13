// ViewResolver Hub Handler
//
// Coordination concept with pluggable providers for View data resolution.
// Registers resolver providers and dispatches resolve calls. Actual data
// fetching happens through syncs, not through direct kernel invocation.

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

export const viewResolverHandler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    const resolverType = input.resolver_type as string;
    const provider = input.provider as string;

    if (!resolverType || !provider) {
      return { variant: 'error', message: 'resolver_type and provider are required' };
    }

    // Check for duplicate registration
    const existing = await storage.find('provider', {});
    const duplicate = (existing as Record<string, unknown>[]).find(
      (p) => (p as Record<string, unknown>).resolver_type === resolverType,
    );
    if (duplicate) {
      return { variant: 'already_registered', resolver_type: resolverType };
    }

    await storage.put('provider', resolverType, {
      resolver_type: resolverType,
      provider_name: provider,
    });

    return { variant: 'ok', resolver_type: resolverType };
  },

  async resolve(input: Record<string, unknown>, storage: ConceptStorage) {
    const view = input.view as string;
    const dataSource = input.data_source as string;
    const filters = input.filters as string;
    const context = input.context as string;

    if (!view) {
      return { variant: 'view_not_found', view: '' };
    }

    if (!dataSource) {
      return { variant: 'error', message: 'data_source is required' };
    }

    // Parse context to determine resolver type
    let resolverType = 'kernel'; // default
    if (context) {
      try {
        const parsed = JSON.parse(context);
        if (parsed.resolver_type) {
          resolverType = parsed.resolver_type as string;
        }
      } catch {
        // Use default
      }
    }

    // Check provider is registered
    const provider = await storage.get('provider', resolverType);
    if (!provider) {
      return { variant: 'no_provider', resolver_type: resolverType };
    }

    // Return ok — the dispatch sync picks this up and routes
    // to the registered provider. Data flows back through the
    // sync completion chain.
    return {
      variant: 'ok',
      data: '[]',
      count: '0',
      view,
      data_source: dataSource,
      filters: filters || '[]',
      resolver_type: resolverType,
    };
  },
};
