// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// TreeSitterSyncSpec Handler — Functional (StorageProgram) style
//
// Grammar provider for Clef sync spec files. Registers the
// YAML WASM parser for .sync file extensions with
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
  return `tree-sitter-sync-spec-${++counter}`;
}

export function resetCounter(): void { counter = 0; }

type Result = { variant: string; [key: string]: unknown };

const _treeSitterSyncSpecHandler: FunctionalConceptHandler = {
  initialize(_input: Record<string, unknown>) {
    const id = nextId();
    let p = createProgram();
    p = put(p, 'tree-sitter-sync-spec', id, {
      id,
      providerRef: id,
      grammarRef: 'tree-sitter-sync-spec',
      wasmPath: 'tree-sitter-yaml.wasm',
      language: 'sync-spec',
      extensions: JSON.stringify(['.sync']),
    });
    return complete(p, 'ok', { instance: id }) as StorageProgram<Result>;
  },
};

export const treeSitterSyncSpecHandler = autoInterpret(_treeSitterSyncSpecHandler);
