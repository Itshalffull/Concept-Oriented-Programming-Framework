// @clef-handler style=functional
// ============================================================
// AnatomyPartEntity Concept Implementation (Functional)
//
// Named part within a widget's anatomy — each carries a semantic
// role and connects to props via the connect section. Independent
// concept — field/action bindings populated by syncs.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.js';
import {
  createProgram, find, put, branch, complete, completeFrom, pureFrom, mapBindings,
} from '../../../runtime/storage-program.js';

export const anatomyPartEntityHandler: FunctionalConceptHandler = {

  register(input) {
    if (!input.widget || (typeof input.widget === 'string' && (input.widget as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'widget is required' }) as StorageProgram<Result>;
    }
    const widget = input.widget as string;
    const name = input.name as string;
    const role = input.role as string;
    const required = input.required as string;
    const id = crypto.randomUUID();
    const key = `part:${widget}/${name}`;

    let p = createProgram();
    return complete(
      put(p, 'part', key, {
        id, widget, name,
        symbol: `clef/widget/${widget}/part/${name}`,
        semanticRole: role || '',
        required: required || 'true',
        description: '',
        connectProps: '[]',
        ariaAttrs: '[]',
        // Populated by syncs from Binding concept
        boundField: '',
        boundAction: '',
      }),
      'ok', { part: id },
    );
  },

  findByRole(input) {
    const role = input.role as string;

    let p = createProgram();
    p = find(p, 'part', {}, 'all');

    return branch(p,
      (b) => (b.all as Array<unknown>).length > 0,
      completeFrom(createProgram(), 'ok', (b) => {
        const all = b.all as Array<Record<string, unknown>>;
        const matching = all.filter(pt => pt.semanticRole === role);
        return { parts: JSON.stringify(matching.map(pt => ({
          id: pt.id, widget: pt.widget, name: pt.name, semanticRole: pt.semanticRole,
        }))) };
      }),
      complete(createProgram(), 'error', { message: 'no parts registered' }),
    );
  },

  findBoundToField(input) {
    const field = input.field as string;

    let p = createProgram();
    p = find(p, 'part', {}, 'all');

    return branch(p,
      (b) => (b.all as Array<unknown>).length > 0,
      completeFrom(createProgram(), 'ok', (b) => {
        const all = b.all as Array<Record<string, unknown>>;
        const matching = all.filter(pt => pt.boundField === field);
        return { parts: JSON.stringify(matching.map(pt => ({
          id: pt.id, widget: pt.widget, name: pt.name, boundField: pt.boundField,
        }))) };
      }),
      complete(createProgram(), 'error', { message: 'no parts registered' }),
    );
  },

  findBoundToAction(input) {
    const action = input.action as string;

    let p = createProgram();
    p = find(p, 'part', {}, 'all');

    return branch(p,
      (b) => (b.all as Array<unknown>).length > 0,
      completeFrom(createProgram(), 'ok', (b) => {
        const all = b.all as Array<Record<string, unknown>>;
        const matching = all.filter(pt => pt.boundAction === action);
        return { parts: JSON.stringify(matching.map(pt => ({
          id: pt.id, widget: pt.widget, name: pt.name, boundAction: pt.boundAction,
        }))) };
      }),
      complete(createProgram(), 'error', { message: 'no parts registered' }),
    );
  },

  get(input) {
    const part = input.part as string;

    let p = createProgram();
    p = find(p, 'part', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      return all.find(pt => pt.id === part) || null;
    }, 'entry');

    return branch(p,
      (b) => b.entry != null,
      completeFrom(createProgram(), 'ok', (b) => {
        const e = b.entry as Record<string, unknown>;
        return {
          part: e.id, widget: e.widget,
          name: e.name, semanticRole: e.semanticRole, required: e.required,
        };
      }),
      complete(createProgram(), 'notfound', {}),
    );
  },
};
