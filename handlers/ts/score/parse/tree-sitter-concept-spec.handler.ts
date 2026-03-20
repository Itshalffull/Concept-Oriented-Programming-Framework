// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// TreeSitterConceptSpec Handler — Functional (StorageProgram) style
//
// Grammar provider for Clef concept spec files. Registers the
// YAML WASM parser for .concept file extensions with
// LanguageGrammar.
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, put, complete,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

let counter = 0;
function nextId(): string {
  return `tree-sitter-concept-spec-${++counter}`;
}

export function resetCounter(): void { counter = 0; }

type Result = { variant: string; [key: string]: unknown };

const _treeSitterConceptSpecHandler: FunctionalConceptHandler = {
  initialize(_input: Record<string, unknown>) {
    const id = nextId();
    let p = createProgram();
    p = put(p, 'tree-sitter-concept-spec', id, {
      id,
      providerRef: id,
      grammarRef: 'tree-sitter-concept-spec',
      wasmPath: 'tree-sitter-concept-spec.wasm',
      language: 'concept-spec',
      extensions: JSON.stringify(['.concept']),
    });
    return complete(p, 'ok', { instance: id }) as StorageProgram<Result>;
  },
};

export const treeSitterConceptSpecHandler = autoInterpret(_treeSitterConceptSpecHandler);
