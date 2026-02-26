// ============================================================
// WidgetDependenceProvider Handler
//
// Dependence analysis provider for .widget files. Computes
// compose -> composed widget, connect -> prop -> anatomy part,
// and affordance -> interactor dependency edges.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `widget-dependence-provider-${++idCounter}`;
}

export const widgetDependenceProviderHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();
    const providerRef = `dependence-provider:widget`;
    const handledLanguages = 'widget';

    // Check if already registered
    const existing = await storage.find('widget-dependence-provider', { providerRef });
    if (existing.length > 0) {
      return { variant: 'ok', instance: existing[0].id as string };
    }

    // Register this provider in storage
    await storage.put('widget-dependence-provider', id, {
      id,
      providerRef,
      handledLanguages,
    });

    // Register in the plugin registry for discovery by dependence graph computation
    await storage.put('plugin-registry', `dependence-provider:${id}`, {
      id: `dependence-provider:${id}`,
      pluginKind: 'dependence-provider',
      domain: 'widget',
      handledLanguages,
      providerRef,
      instanceId: id,
    });

    return { variant: 'ok', instance: id };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetWidgetDependenceProviderCounter(): void {
  idCounter = 0;
}
