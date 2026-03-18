// @migrated dsl-constructs 2026-03-18
// ============================================================
// TreeSitterTypeScript Handler — Functional (StorageProgram) style
//
// Grammar provider for TypeScript files. Registers the
// TypeScript WASM parser for .ts and .tsx file extensions
// with LanguageGrammar.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, put, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

let counter = 0;
function nextId(): string {
  return `tree-sitter-typescript-${++counter}`;
}

export function resetCounter(): void { counter = 0; }

type Result = { variant: string; [key: string]: unknown };

const _treeSitterTypeScriptHandler: FunctionalConceptHandler = {
  initialize(_input: Record<string, unknown>) {
    const id = nextId();
    let p = createProgram();
    p = put(p, 'tree-sitter-typescript', id, {
      id,
      providerRef: id,
      grammarRef: 'tree-sitter-typescript',
      wasmPath: 'tree-sitter-typescript.wasm',
      language: 'typescript',
      extensions: JSON.stringify(['.ts', '.tsx']),
    });
    return complete(p, 'ok', { instance: id }) as StorageProgram<Result>;
  },
};

export const treeSitterTypeScriptHandler = autoInterpret(_treeSitterTypeScriptHandler);
