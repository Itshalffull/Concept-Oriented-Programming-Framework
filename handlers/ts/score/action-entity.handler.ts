// @clef-handler style=imperative
// ============================================================
// ActionEntity Concept Implementation (Functional)
//
// Action declaration with full lifecycle tracing — from spec
// through sync participation, implementation, interface exposure,
// to runtime invocation. Independent concept — cross-entity
// data (syncs, implementations) populated by syncs.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.js';
import {
  createProgram, get, find, put, branch, complete, pureFrom, mapBindings,
} from '../../../runtime/storage-program.js';

export const actionEntityHandler: FunctionalConceptHandler = {

  register(input) {
    const concept = input.concept as string;
    const name = input.name as string;
    const params = input.params as string;
    const variantRefs = input.variantRefs as string;
    const id = crypto.randomUUID();
    const key = `action:${concept}/${name}`;

    let p = createProgram();
    return complete(
      put(p, 'action', key, {
        id,
        concept,
        name,
        symbol: `clef/action/${concept}/${name}`,
        sourceFile: '',
        startLine: 0,
        endLine: 0,
        params: params || '[]',
        variants: variantRefs || '[]',
        implementationSymbols: '[]',
        // Populated by syncs from SyncEntity/register
        triggeringSyncsCache: '[]',
        invokingSyncsCache: '[]',
        // Populated by syncs from InterfaceEntity/register
        interfaceExposuresCache: '[]',
      }),
      'ok', { action: id },
    );
  },

  findByConcept(input) {
    const concept = input.concept as string;

    let p = createProgram();
    p = find(p, 'action', { concept }, 'matches');
    p = mapBindings(p, (b) => {
      const matches = b.matches as Array<Record<string, unknown>>;
      return JSON.stringify(matches.map(a => ({
        id: a.id, name: a.name, concept: a.concept, params: a.params,
      })));
    }, 'result');

    return pureFrom(p, (b) => ({ variant: 'ok', actions: b.result }));
  },

  triggeringSyncs(input) {
    const action = input.action as string;

    let p = createProgram();
    p = find(p, 'action', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      const entry = all.find(a => a.id === action);
      return entry ? (entry.triggeringSyncsCache as string || '[]') : '[]';
    }, 'syncs');

    return pureFrom(p, (b) => ({ variant: 'ok', syncs: b.syncs }));
  },

  invokingSyncs(input) {
    const action = input.action as string;

    let p = createProgram();
    p = find(p, 'action', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      const entry = all.find(a => a.id === action);
      return entry ? (entry.invokingSyncsCache as string || '[]') : '[]';
    }, 'syncs');

    return pureFrom(p, (b) => ({ variant: 'ok', syncs: b.syncs }));
  },

  implementations(input) {
    const action = input.action as string;

    let p = createProgram();
    p = find(p, 'action', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      const entry = all.find(a => a.id === action);
      return entry ? (entry.implementationSymbols as string || '[]') : '[]';
    }, 'symbols');

    return pureFrom(p, (b) => ({ variant: 'ok', symbols: b.symbols }));
  },

  interfaceExposures(input) {
    const action = input.action as string;

    let p = createProgram();
    p = find(p, 'action', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      const entry = all.find(a => a.id === action);
      return entry ? (entry.interfaceExposuresCache as string || '[]') : '[]';
    }, 'exposures');

    return pureFrom(p, (b) => ({ variant: 'ok', exposures: b.exposures }));
  },

  get(input) {
    const action = input.action as string;

    let p = createProgram();
    p = find(p, 'action', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      return all.find(a => a.id === action) || null;
    }, 'entry');

    return branch(p,
      (b) => b.entry != null,
      pureFrom(createProgram(), (b) => {
        const e = b.entry as Record<string, unknown>;
        const variants: unknown[] = JSON.parse(e.variants as string || '[]');
        return {
          variant: 'ok',
          action: e.id, concept: e.concept, name: e.name,
          params: e.params, variantCount: variants.length,
        };
      }),
      complete(createProgram(), 'notfound', {}),
    );
  },
};
