// @migrated dsl-constructs 2026-03-18
// ============================================================
// TreeSitterJson Handler — Functional (StorageProgram) style
//
// Grammar provider for JSON files. Registers the JSON WASM
// parser for .json file extensions with LanguageGrammar.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, put, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

let counter = 0;
function nextId(): string {
  return `tree-sitter-json-${++counter}`;
}

export function resetCounter(): void { counter = 0; }

type Result = { variant: string; [key: string]: unknown };

const _treeSitterJsonHandler: FunctionalConceptHandler = {
  initialize(_input: Record<string, unknown>) {
    const id = nextId();
    let p = createProgram();
    p = put(p, 'tree-sitter-json', id, {
      id,
      providerRef: id,
      grammarRef: 'tree-sitter-json',
      wasmPath: 'tree-sitter-json.wasm',
      language: 'json',
      extensions: JSON.stringify(['.json']),
    });
    return complete(p, 'ok', { instance: id }) as StorageProgram<Result>;
  },
};

export const treeSitterJsonHandler = autoInterpret(_treeSitterJsonHandler);
