// ============================================================
// TreeSitterThemeSpec Handler
//
// Grammar provider for Clef Surface theme spec files.
// Registers the theme spec parser for .theme file extensions
// with LanguageGrammar.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../../runtime/types.js';

let counter = 0;
function nextId(): string {
  return `tree-sitter-theme-spec-${++counter}`;
}

export function resetCounter(): void { counter = 0; }

export const treeSitterThemeSpecHandler: ConceptHandler = {
  async initialize(_input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();
    await storage.put('tree-sitter-theme-spec', id, {
      id,
      providerRef: id,
      grammarRef: 'tree-sitter-theme-spec',
      wasmPath: 'tree-sitter-theme-spec.wasm',
      language: 'theme-spec',
      extensions: JSON.stringify(['.theme']),
    });
    return { variant: 'ok', instance: id };
  },
};
