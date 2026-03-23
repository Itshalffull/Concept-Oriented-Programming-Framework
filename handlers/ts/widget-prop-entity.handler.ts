// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// WidgetPropEntity Handler
//
// A declared prop on a widget -- typed, with default value,
// connected to anatomy parts and ultimately to concept state
// fields via Binding. Enables tracing from concept fields through
// props to rendered anatomy parts.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `widget-prop-entity-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    if (!input.widget || (typeof input.widget === 'string' && (input.widget as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'widget is required' }) as StorageProgram<Result>;
    }
    if (!input.defaultValue || (typeof input.defaultValue === 'string' && (input.defaultValue as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'defaultValue is required' }) as StorageProgram<Result>;
    }
    const widget = input.widget as string;
    const name = input.name as string;
    const typeExpr = input.typeExpr as string;
    const defaultValue = input.defaultValue as string;

    const id = nextId();
    const symbol = `clef/prop/${widget}/${name}`;

    let p = createProgram();
    p = put(p, 'widget-prop-entity', id, {
      id,
      widget,
      name,
      symbol,
      typeExpr,
      defaultValue,
      connectedParts: '[]',
    });

    return complete(p, 'ok', { prop: id }) as StorageProgram<Result>;
  },

  findByWidget(input: Record<string, unknown>) {
    if (!input.widget || (typeof input.widget === 'string' && (input.widget as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'widget is required' }) as StorageProgram<Result>;
    }
    const widget = input.widget as string;

    let p = createProgram();
    p = find(p, 'widget-prop-entity', { widget }, 'results');

    return completeFrom(p, 'ok', (bindings) => ({
      props: JSON.stringify(bindings.results),
    })) as StorageProgram<Result>;
  },

  traceToField(input: Record<string, unknown>) {
    const prop = input.prop as string;

    let p = createProgram();
    p = get(p, 'widget-prop-entity', prop, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = find(thenP, 'binding', {}, 'allBindings');
        return completeFrom(thenP, 'ok', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const symbol = record.symbol as string;
          const allBindings = bindings.allBindings as Record<string, unknown>[];
          const binding = allBindings.find((b) => b.propSymbol === symbol);
          if (!binding) {
            return { variant: 'noBinding' };
          }
          return {
            field: binding.fieldSymbol as string,
            concept: binding.concept as string,
          };
        });
      },
      (elseP) => complete(elseP, 'noBinding', {}),
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const prop = input.prop as string;

    let p = createProgram();
    p = get(p, 'widget-prop-entity', prop, 'record');

    return branch(p, 'record',
      (thenP) => completeFrom(thenP, 'ok', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        return {
          prop: record.id as string,
          widget: record.widget as string,
          name: record.name as string,
          typeExpr: record.typeExpr as string,
          defaultValue: record.defaultValue as string,
        };
      }),
      (elseP) => complete(elseP, 'notfound', {}),
    ) as StorageProgram<Result>;
  },
};

export const widgetPropEntityHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetWidgetPropEntityCounter(): void {
  idCounter = 0;
}
