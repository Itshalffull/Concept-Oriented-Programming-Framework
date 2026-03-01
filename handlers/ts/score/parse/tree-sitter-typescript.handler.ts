// ============================================================
// TreeSitterTypeScript Handler
//
// Grammar provider for TypeScript files. Registers the
// TypeScript WASM parser for .ts and .tsx file extensions
// with LanguageGrammar.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../../runtime/types.js';

let counter = 0;
function nextId(): string {
  return `tree-sitter-typescript-${++counter}`;
}

export function resetCounter(): void { counter = 0; }

export const treeSitterTypeScriptHandler: ConceptHandler = {
  async initialize(_input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();
    await storage.put('tree-sitter-typescript', id, {
      id,
      providerRef: id,
      grammarRef: 'tree-sitter-typescript',
      wasmPath: 'tree-sitter-typescript.wasm',
      language: 'typescript',
      extensions: JSON.stringify(['.ts', '.tsx']),
    });
    return { variant: 'ok', instance: id };
  },
};
