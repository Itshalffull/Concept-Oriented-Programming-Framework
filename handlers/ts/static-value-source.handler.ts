// ============================================================
// StaticValueSource Handler
//
// SlotSource provider that returns a hardcoded static value.
// Registers with PluginRegistry under slot_source_provider.
// See Architecture doc Section 16.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `svs-${++idCounter}`;
}

let registered = false;

export const staticValueSourceHandler: ConceptHandler = {
  async register(_input: Record<string, unknown>, storage: ConceptStorage) {
    if (registered) {
      return { variant: 'already_registered' };
    }

    registered = true;
    await storage.put('static-value-source', '__registered', { value: true });

    return { variant: 'ok', provider_name: 'static_value' };
  },

  async resolve(input: Record<string, unknown>, storage: ConceptStorage) {
    const value = input.value as string;
    const contentType = input.content_type as string | undefined;
    const context = input.context as string;

    if (value === undefined || value === null) {
      return { variant: 'error', message: 'value is required' };
    }

    // Validate context JSON if provided
    if (context) {
      try {
        JSON.parse(context);
      } catch {
        return { variant: 'error', message: `Invalid context JSON: ${context}` };
      }
    }

    const id = nextId();
    await storage.put('static-value-source', id, {
      id,
      value,
      content_type: contentType || 'text/plain',
      createdAt: new Date().toISOString(),
    });

    return { variant: 'ok', data: String(value) };
  },
};

/** Reset internal state. Useful for testing. */
export function resetStaticValueSource(): void {
  idCounter = 0;
  registered = false;
}
