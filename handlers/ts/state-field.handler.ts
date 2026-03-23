// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// StateField Handler
//
// Single state declaration in a concept, traced through code
// generation and storage mapping. Enables impact analysis --
// "if I change this field's type, what generated code and storage
// schemas are affected?"
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `state-field-${++idCounter}`;
}

/**
 * Infer cardinality from a type expression string.
 */
function inferCardinality(typeExpr: string): string {
  const t = typeExpr.trim().toLowerCase();
  if (t.startsWith('set ')) return 'set';
  if (t.includes('->')) return 'mapping';
  if (t.startsWith('list ')) return 'list';
  if (t.startsWith('option ') || t.endsWith('?')) return 'option';
  return 'scalar';
}

const _handler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    if (!input.concept || (typeof input.concept === 'string' && (input.concept as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'concept is required' }) as StorageProgram<Result>;
    }
    const concept = input.concept as string;
    const name = input.name as string;
    const typeExpr = input.typeExpr as string;

    const id = nextId();
    const symbol = `clef/field/${concept}/${name}`;
    const cardinality = inferCardinality(typeExpr);

    let p = createProgram();
    p = put(p, 'state-field', id, {
      id,
      concept,
      name,
      symbol,
      typeExpr,
      cardinality,
      group: '',
      generatedSymbols: '[]',
    });

    return complete(p, 'ok', { field: id }) as StorageProgram<Result>;
  },

  findByConcept(input: Record<string, unknown>) {
    if (!input.concept || (typeof input.concept === 'string' && (input.concept as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'concept is required' }) as StorageProgram<Result>;
    }
    const concept = input.concept as string;

    let p = createProgram();
    p = find(p, 'state-field', { concept }, 'results');

    return completeFrom(p, 'ok', (bindings) => {
      const results = bindings.results as Record<string, unknown>[];
      return { fields: JSON.stringify(results) };
    }) as StorageProgram<Result>;
  },

  traceToGenerated(input: Record<string, unknown>) {
    const field = input.field as string;

    let p = createProgram();
    p = get(p, 'state-field', field, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = find(thenP, 'provenance', {}, 'allProvenance');
        return completeFrom(thenP, 'ok', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const allProvenance = bindings.allProvenance as Record<string, unknown>[];
          const generated = allProvenance.filter(g => g.sourceSymbol === record.symbol);
          const targets = generated.map((g) => ({
            language: g.language || 'typescript',
            symbol: g.targetSymbol || g.symbol,
            file: g.file || g.targetFile,
          }));

          return { targets: JSON.stringify(targets) };
        });
      },
      (elseP) => complete(elseP, 'ok', { targets: '[]' }),
    ) as StorageProgram<Result>;
  },

  traceToStorage(input: Record<string, unknown>) {
    const field = input.field as string;

    let p = createProgram();
    p = get(p, 'state-field', field, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = find(thenP, 'storage-mapping', {}, 'allMappings');
        return completeFrom(thenP, 'ok', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const allMappings = bindings.allMappings as Record<string, unknown>[];
          const mappings = allMappings.filter(m => m.fieldSymbol === record.symbol);
          const targets = mappings.map((m) => ({
            adapter: m.adapter || 'default',
            columnOrKey: m.columnOrKey || m.column || record.name,
          }));

          return { targets: JSON.stringify(targets) };
        });
      },
      (elseP) => complete(elseP, 'ok', { targets: '[]' }),
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const field = input.field as string;

    let p = createProgram();
    p = get(p, 'state-field', field, 'record');

    return branch(p, 'record',
      (thenP) => {
        return completeFrom(thenP, 'ok', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return {
            field: record.id as string,
            concept: record.concept as string,
            name: record.name as string,
            typeExpr: record.typeExpr as string,
            cardinality: record.cardinality as string,
          };
        });
      },
      (elseP) => complete(elseP, 'notfound', {}),
    ) as StorageProgram<Result>;
  },
};

export const stateFieldHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetStateFieldCounter(): void {
  idCounter = 0;
}
