// ============================================================
// TreeSitterJson Handler
//
// Grammar provider for JSON files. Registers the JSON WASM
// parser for .json file extensions with LanguageGrammar.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../../runtime/types.js';

let counter = 0;
function nextId(): string {
  return `tree-sitter-json-${++counter}`;
}

export function resetCounter(): void { counter = 0; }

export const treeSitterJsonHandler: ConceptHandler = {
  async initialize(_input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();
    await storage.put('tree-sitter-json', id, {
      id,
      providerRef: id,
      grammarRef: 'tree-sitter-json',
      wasmPath: 'tree-sitter-json.wasm',
      language: 'json',
      extensions: JSON.stringify(['.json']),
    });
    return { variant: 'ok', instance: id };
  },
};
