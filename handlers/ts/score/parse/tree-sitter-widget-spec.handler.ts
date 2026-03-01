// ============================================================
// TreeSitterWidgetSpec Handler
//
// Grammar provider for Clef Surface widget spec files.
// Registers the widget spec parser for .widget file extensions
// with LanguageGrammar.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../../runtime/types.js';

let counter = 0;
function nextId(): string {
  return `tree-sitter-widget-spec-${++counter}`;
}

export function resetCounter(): void { counter = 0; }

export const treeSitterWidgetSpecHandler: ConceptHandler = {
  async initialize(_input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();
    await storage.put('tree-sitter-widget-spec', id, {
      id,
      providerRef: id,
      grammarRef: 'tree-sitter-widget-spec',
      wasmPath: 'tree-sitter-widget-spec.wasm',
      language: 'widget-spec',
      extensions: JSON.stringify(['.widget']),
    });
    return { variant: 'ok', instance: id };
  },
};
