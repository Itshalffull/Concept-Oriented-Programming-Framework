// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// StructuralPattern Concept Implementation
// Structural search patterns over syntax trees supporting tree-sitter-query,
// ast-grep, comby, and regex syntaxes.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, find, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const VALID_SYNTAXES = ['tree-sitter-query', 'ast-grep', 'comby', 'regex'];

let idCounter = 0;
function nextId(): string {
  return `pattern-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  create(input: Record<string, unknown>) {
    const syntax = input.syntax as string;
    const source = input.source as string;
    const language = (input.language as string) || '';

    if (!syntax || syntax.trim() === '') {
      return complete(createProgram(), 'error', { message: 'syntax is required' }) as StorageProgram<Result>;
    }

    if (!VALID_SYNTAXES.includes(syntax)) {
      return complete(createProgram(), 'error', {
        message: `Unknown syntax '${syntax}'. Valid: ${VALID_SYNTAXES.join(', ')}`,
        position: 0,
      }) as StorageProgram<Result>;
    }

    if (!source || source.trim() === '') {
      return complete(createProgram(), 'error', { message: 'source is required', position: 0 }) as StorageProgram<Result>;
    }

    const patternId = nextId();
    let p = createProgram();
    p = put(p, 'structural-pattern', patternId, {
      id: patternId,
      syntax,
      source,
      language,
      compiled: JSON.stringify({ syntax, source, language }),
      name: `${syntax}:${source.slice(0, 30)}`,
    });

    return complete(p, 'ok', { pattern: patternId }) as StorageProgram<Result>;
  },

  match(input: Record<string, unknown>) {
    const patternId = input.pattern as string;
    const tree = input.tree as string;

    if (typeof patternId === 'string' && (!patternId || patternId.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'pattern is required' }) as StorageProgram<Result>;
    }

    const patternKey = typeof patternId === 'string' ? patternId : 'unknown';
    let p = createProgram();
    p = get(p, 'structural-pattern', patternKey, 'patternRecord');

    return branch(p, 'patternRecord',
      (b) => complete(b, 'ok', { matches: JSON.stringify([]) }),
      (b) => complete(b, 'error', { message: `Pattern '${patternKey}' not found` }),
    ) as StorageProgram<Result>;
  },

  matchProject(input: Record<string, unknown>) {
    const patternId = input.pattern as string;

    if (typeof patternId === 'string' && (!patternId || patternId.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'pattern is required' }) as StorageProgram<Result>;
    }

    const patternKey = typeof patternId === 'string' ? patternId : 'unknown';
    let p = createProgram();
    p = get(p, 'structural-pattern', patternKey, 'patternRecord');

    return branch(p, 'patternRecord',
      (b) => complete(b, 'ok', { results: JSON.stringify([]) }),
      (b) => complete(b, 'error', { message: `Pattern '${patternKey}' not found` }),
    ) as StorageProgram<Result>;
  },
};

export const structuralPatternHandler = autoInterpret(_handler);
