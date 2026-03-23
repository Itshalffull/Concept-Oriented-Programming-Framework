// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// AnatomyPartEntity Handler
//
// Named part within a widget's anatomy -- each carries a semantic role
// and connects to props via the connect section. Enables tracing
// from rendered UI elements back to concept state fields and
// actions.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

let idCounter = 0;
function nextId(): string {
  return `anatomy-part-entity-${++idCounter}`;
}

type Result = { variant: string; [key: string]: unknown };

const _anatomyPartEntityHandler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const widget = input.widget as string;
    const name = input.name as string;
    const role = input.role as string;
    const required = input.required as string;

    const id = nextId();
    const symbol = `clef/anatomy/${widget}/${name}`;

    let p = createProgram();
    p = put(p, 'anatomy-part-entity', id, {
      id,
      widget,
      name,
      symbol,
      semanticRole: role,
      required,
      description: '',
      connectProps: '[]',
      ariaAttrs: '[]',
      boundField: '',
      boundAction: '',
    });

    return complete(p, 'ok', { part: id }) as StorageProgram<Result>;
  },

  findByRole(input: Record<string, unknown>) {
    const role = input.role as string;

    let p = createProgram();
    p = find(p, 'anatomy-part-entity', { semanticRole: role }, 'results');

    return completeFrom(p, 'ok', (bindings) => ({
      parts: JSON.stringify(bindings.results),
    })) as StorageProgram<Result>;
  },

  findBoundToField(input: Record<string, unknown>) {
    const field = input.field as string;

    let p = createProgram();
    p = find(p, 'anatomy-part-entity', { boundField: field }, 'results');

    return completeFrom(p, 'ok', (bindings) => ({
      parts: JSON.stringify(bindings.results),
    })) as StorageProgram<Result>;
  },

  findBoundToAction(input: Record<string, unknown>) {
    const action = input.action as string;

    let p = createProgram();
    p = find(p, 'anatomy-part-entity', { boundAction: action }, 'results');

    return completeFrom(p, 'ok', (bindings) => ({
      parts: JSON.stringify(bindings.results),
    })) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const part = input.part as string;

    let p = createProgram();
    p = get(p, 'anatomy-part-entity', part, 'record');

    p = branch(p, 'record',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        return {
          part: record.id as string,
          widget: record.widget as string,
          name: record.name as string,
          semanticRole: record.semanticRole as string,
          required: record.required as string,
        };
      }) as StorageProgram<Result>,
      (b) => complete(b, 'notfound', {}) as StorageProgram<Result>,
    ) as StorageProgram<Result>;

    return p;
  },
};

export const anatomyPartEntityHandler = autoInterpret(_anatomyPartEntityHandler);

/** Reset the ID counter. Useful for testing. */
export function resetAnatomyPartEntityCounter(): void {
  idCounter = 0;
}
