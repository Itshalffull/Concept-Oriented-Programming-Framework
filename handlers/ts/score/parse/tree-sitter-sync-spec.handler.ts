// ============================================================
// TreeSitterSyncSpec Handler
//
// Grammar provider for Clef sync spec files. Registers the
// YAML WASM parser for .sync file extensions with
// LanguageGrammar.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../../runtime/types.js';

let counter = 0;
function nextId(): string {
  return `tree-sitter-sync-spec-${++counter}`;
}

export function resetCounter(): void { counter = 0; }

export const treeSitterSyncSpecHandler: ConceptHandler = {
  async initialize(_input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();
    await storage.put('tree-sitter-sync-spec', id, {
      id,
      providerRef: id,
      grammarRef: 'tree-sitter-sync-spec',
      wasmPath: 'tree-sitter-yaml.wasm',
      language: 'sync-spec',
      extensions: JSON.stringify(['.sync']),
    });
    return { variant: 'ok', instance: id };
  },
};
