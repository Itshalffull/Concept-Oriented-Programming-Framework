// ============================================================
// SymbolIndex Handler
//
// Search index provider using symbol-aware indexing. Maintains
// an index of symbols by name, kind, and namespace for fast
// symbol resolution and lookup.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.js';

let counter = 0;
function nextId(): string {
  return `symbol-index-${++counter}`;
}

export function resetCounter(): void { counter = 0; }

export const symbolIndexHandler: ConceptHandler = {
  async initialize(_input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();
    await storage.put('symbol-index', id, {
      id,
      providerRef: id,
      indexType: 'symbol-aware',
    });
    return { variant: 'ok', instance: id };
  },
};
