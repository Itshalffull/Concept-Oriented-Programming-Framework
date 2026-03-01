// ============================================================
// TreeSitterYaml Handler
//
// Grammar provider for YAML files. Registers the YAML WASM
// parser for .yaml and .yml file extensions with
// LanguageGrammar.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../../runtime/types.js';

let counter = 0;
function nextId(): string {
  return `tree-sitter-yaml-${++counter}`;
}

export function resetCounter(): void { counter = 0; }

export const treeSitterYamlHandler: ConceptHandler = {
  async initialize(_input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();
    await storage.put('tree-sitter-yaml', id, {
      id,
      providerRef: id,
      grammarRef: 'tree-sitter-yaml',
      wasmPath: 'tree-sitter-yaml.wasm',
      language: 'yaml',
      extensions: JSON.stringify(['.yaml', '.yml']),
    });
    return { variant: 'ok', instance: id };
  },
};
