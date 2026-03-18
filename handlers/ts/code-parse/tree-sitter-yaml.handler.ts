// @migrated dsl-constructs 2026-03-18
// ============================================================
// TreeSitterYaml Handler — Functional (StorageProgram) style
//
// Grammar provider for YAML files. Registers the YAML WASM
// parser for .yaml and .yml file extensions with
// LanguageGrammar.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, put, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

let counter = 0;
function nextId(): string {
  return `tree-sitter-yaml-${++counter}`;
}

export function resetCounter(): void { counter = 0; }

type Result = { variant: string; [key: string]: unknown };

const _treeSitterYamlHandler: FunctionalConceptHandler = {
  initialize(_input: Record<string, unknown>) {
    const id = nextId();
    let p = createProgram();
    p = put(p, 'tree-sitter-yaml', id, {
      id,
      providerRef: id,
      grammarRef: 'tree-sitter-yaml',
      wasmPath: 'tree-sitter-yaml.wasm',
      language: 'yaml',
      extensions: JSON.stringify(['.yaml', '.yml']),
    });
    return complete(p, 'ok', { instance: id }) as StorageProgram<Result>;
  },
};

export const treeSitterYamlHandler = autoInterpret(_treeSitterYamlHandler);
