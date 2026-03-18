// @migrated dsl-constructs 2026-03-18
// ============================================================
// TreeSitterWidgetSpec Handler — Functional (StorageProgram) style
//
// Grammar provider for Clef Surface widget spec files.
// Registers the widget spec parser for .widget file extensions
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
  return `tree-sitter-widget-spec-${++counter}`;
}

export function resetCounter(): void { counter = 0; }

type Result = { variant: string; [key: string]: unknown };

const _treeSitterWidgetSpecHandler: FunctionalConceptHandler = {
  initialize(_input: Record<string, unknown>) {
    const id = nextId();
    let p = createProgram();
    p = put(p, 'tree-sitter-widget-spec', id, {
      id,
      providerRef: id,
      grammarRef: 'tree-sitter-widget-spec',
      wasmPath: 'tree-sitter-widget-spec.wasm',
      language: 'widget-spec',
      extensions: JSON.stringify(['.widget']),
    });
    return complete(p, 'ok', { instance: id }) as StorageProgram<Result>;
  },
};

export const treeSitterWidgetSpecHandler = autoInterpret(_treeSitterWidgetSpecHandler);
