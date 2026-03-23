// @clef-handler style=functional
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
  createProgram, get, find, put, branch, complete, completeFrom, pureFrom, mapBindings,
} from '../../../runtime/storage-program.js';

export const actionEntityHandler: FunctionalConceptHandler = {

  register(input) {
    if (!input.concept || (typeof input.concept === 'string' && (input.concept as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'concept is required' }) as StorageProgram<Result>;
    }
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
    if (!input.concept || (typeof input.concept === 'string' && (input.concept as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'concept is required' }) as StorageProgram<Result>;
    }
    const concept = input.concept as string;

    let p = createProgram();
    p = find(p, 'action', { concept }, 'matches');
    p = mapBindings(p, (b) => {
      const matches = b.matches as Array<Record<string, unknown>>;
      return JSON.stringify(matches.map(a => ({
        id: a.id, name: a.name, concept: a.concept, params: a.params,
      })));
    }, 'result');

    return completeFrom(p, 'ok', (b) => ({ actions: b.result }));
  },

  triggeringSyncs(input) {
    const action = input.action as string;

    let p = createProgram();
    p = find(p, 'action', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      return all.find(a => a.id === action) || null;
    }, 'entry');

    return branch(p,
      (b) => b.entry != null,
      completeFrom(createProgram(), 'ok', (b) => {
        const entry = b.entry as Record<string, unknown>;
        return { syncs: entry.triggeringSyncsCache as string || '[]' };
      }),
      complete(createProgram(), 'error', { message: 'action not found' }),
    );
  },

  invokingSyncs(input) {
    const action = input.action as string;

    let p = createProgram();
    p = find(p, 'action', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      return all.find(a => a.id === action) || null;
    }, 'entry');

    return branch(p,
      (b) => b.entry != null,
      completeFrom(createProgram(), 'ok', (b) => {
        const entry = b.entry as Record<string, unknown>;
        return { syncs: entry.invokingSyncsCache as string || '[]' };
      }),
      complete(createProgram(), 'error', { message: 'action not found' }),
    );
  },

  implementations(input) {
    const action = input.action as string;

    let p = createProgram();
    p = find(p, 'action', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      return all.find(a => a.id === action) || null;
    }, 'entry');

    return branch(p,
      (b) => b.entry != null,
      completeFrom(createProgram(), 'ok', (b) => {
        const entry = b.entry as Record<string, unknown>;
        return { symbols: entry.implementationSymbols as string || '[]' };
      }),
      complete(createProgram(), 'error', { message: 'action not found' }),
    );
  },

  interfaceExposures(input) {
    const action = input.action as string;

    let p = createProgram();
    p = find(p, 'action', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      return all.find(a => a.id === action) || null;
    }, 'entry');

    return branch(p,
      (b) => b.entry != null,
      completeFrom(createProgram(), 'ok', (b) => {
        const entry = b.entry as Record<string, unknown>;
        return { exposures: entry.interfaceExposuresCache as string || '[]' };
      }),
      complete(createProgram(), 'error', { message: 'action not found' }),
    );
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
      completeFrom(createProgram(), 'ok', (b) => {
        const e = b.entry as Record<string, unknown>;
        const variants: unknown[] = JSON.parse(e.variants as string || '[]');
        return {
          action: e.id, concept: e.concept, name: e.name,
          params: e.params, variantCount: variants.length,
        };
      }),
      complete(createProgram(), 'notfound', {}),
    );
  },
};
