// ============================================================
// ThemeDependenceProvider Handler
//
// Dependence analysis provider for .theme files. Computes
// extends -> parent theme, role -> palette color, and token
// reference chain dependency edges.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `theme-dependence-provider-${++idCounter}`;
}

export const themeDependenceProviderHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();
    const providerRef = `dependence-provider:theme`;
    const handledLanguages = 'theme';

    // Check if already registered
    const existing = await storage.find('theme-dependence-provider', { providerRef });
    if (existing.length > 0) {
      return { variant: 'ok', instance: existing[0].id as string };
    }

    // Register this provider in storage
    await storage.put('theme-dependence-provider', id, {
      id,
      providerRef,
      handledLanguages,
    });

    // Register in the plugin registry for discovery by dependence graph computation
    await storage.put('plugin-registry', `dependence-provider:${id}`, {
      id: `dependence-provider:${id}`,
      pluginKind: 'dependence-provider',
      domain: 'theme',
      handledLanguages,
      providerRef,
      instanceId: id,
    });

    return { variant: 'ok', instance: id };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetThemeDependenceProviderCounter(): void {
  idCounter = 0;
}
