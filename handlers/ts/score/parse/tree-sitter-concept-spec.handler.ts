// ============================================================
// TreeSitterConceptSpec Handler
//
// Grammar provider for Clef concept spec files. Registers the
// YAML WASM parser for .concept file extensions with
// LanguageGrammar.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../../runtime/types.js';

let counter = 0;
function nextId(): string {
  return `tree-sitter-concept-spec-${++counter}`;
}

export function resetCounter(): void { counter = 0; }

export const treeSitterConceptSpecHandler: ConceptHandler = {
  async initialize(_input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();
    await storage.put('tree-sitter-concept-spec', id, {
      id,
      providerRef: id,
      grammarRef: 'tree-sitter-concept-spec',
      wasmPath: 'tree-sitter-concept-spec.wasm',
      language: 'concept-spec',
      extensions: JSON.stringify(['.concept']),
    });
    return { variant: 'ok', instance: id };
  },
};
