// @migrated dsl-constructs 2026-03-18
// ============================================================
// TreeSitterThemeSpec Handler — Functional (StorageProgram) style
//
// Grammar provider for Clef Surface theme spec files.
// Registers the theme spec parser for .theme file extensions
// with LanguageGrammar.
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, put, complete,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

let counter = 0;
function nextId(): string {
  return `tree-sitter-theme-spec-${++counter}`;
}

export function resetCounter(): void { counter = 0; }

type Result = { variant: string; [key: string]: unknown };

const _treeSitterThemeSpecHandler: FunctionalConceptHandler = {
  initialize(_input: Record<string, unknown>) {
    const id = nextId();
    let p = createProgram();
    p = put(p, 'tree-sitter-theme-spec', id, {
      id,
      providerRef: id,
      grammarRef: 'tree-sitter-theme-spec',
      wasmPath: 'tree-sitter-theme-spec.wasm',
      language: 'theme-spec',
      extensions: JSON.stringify(['.theme']),
    });
    return complete(p, 'ok', { instance: id }) as StorageProgram<Result>;
  },
};

export const treeSitterThemeSpecHandler = autoInterpret(_treeSitterThemeSpecHandler);
