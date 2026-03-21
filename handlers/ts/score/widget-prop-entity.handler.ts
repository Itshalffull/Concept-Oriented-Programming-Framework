// @clef-handler style=functional
// ============================================================
// WidgetPropEntity Concept Implementation (Functional)
//
// A declared prop on a widget — typed, with default value,
// connected to anatomy parts and ultimately to concept state
// fields via Binding. Independent concept — field bindings
// populated by syncs.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.js';
import {
  createProgram, find, put, branch, complete, completeFrom, pureFrom, mapBindings,
} from '../../../runtime/storage-program.js';

export const widgetPropEntityHandler: FunctionalConceptHandler = {

  register(input) {
    const widget = input.widget as string;
    const name = input.name as string;
    const typeExpr = input.typeExpr as string;
    const defaultValue = input.defaultValue as string;
    const id = crypto.randomUUID();
    const key = `prop:${widget}/${name}`;

    let p = createProgram();
    return complete(
      put(p, 'prop', key, {
        id, widget, name,
        symbol: `clef/widget/${widget}/prop/${name}`,
        typeExpr: typeExpr || '',
        defaultValue: defaultValue || '',
        connectedParts: '[]',
        // Populated by syncs from Binding concept
        boundField: '',
        boundConcept: '',
        bindingVia: '',
      }),
      'ok', { prop: id },
    );
  },

  findByWidget(input) {
    const widget = input.widget as string;

    let p = createProgram();
    p = find(p, 'prop', { widget }, 'matches');
    p = mapBindings(p, (b) => {
      const matches = b.matches as Array<Record<string, unknown>>;
      return JSON.stringify(matches.map(pr => ({
        id: pr.id, name: pr.name, typeExpr: pr.typeExpr, defaultValue: pr.defaultValue,
      })));
    }, 'result');

    return completeFrom(p, 'ok', (b) => ({ props: b.result }));
  },

  traceToField(input) {
    const prop = input.prop as string;

    let p = createProgram();
    p = find(p, 'prop', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      return all.find(pr => pr.id === prop) || null;
    }, 'entry');

    return branch(p,
      (b) => {
        const e = b.entry as Record<string, unknown> | null;
        return e != null && !!e.boundField;
      },
      completeFrom(createProgram(), 'ok', (b) => {
        const e = b.entry as Record<string, unknown>;
        return {
          field: e.boundField, concept: e.boundConcept,
          viaBinding: e.bindingVia,
        };
      }),
      complete(createProgram(), 'noBinding', {}),
    );
  },

  get(input) {
    const prop = input.prop as string;

    let p = createProgram();
    p = find(p, 'prop', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      return all.find(pr => pr.id === prop) || null;
    }, 'entry');

    return branch(p,
      (b) => b.entry != null,
      completeFrom(createProgram(), 'ok', (b) => {
        const e = b.entry as Record<string, unknown>;
        return {
          prop: e.id, widget: e.widget,
          name: e.name, typeExpr: e.typeExpr, defaultValue: e.defaultValue,
        };
      }),
      complete(createProgram(), 'notfound', {}),
    );
  },
};
