// ============================================================
// StateField Concept Implementation (Functional)
//
// Single state declaration in a concept, traced through code
// generation and storage mapping. Independent concept — generated
// symbols and storage mappings populated by syncs.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.js';
import {
  createProgram, get, find, put, branch, complete, pureFrom, mapBindings,
} from '../../../runtime/storage-program.js';

export const stateFieldEntityHandler: FunctionalConceptHandler = {

  register(input) {
    const concept = input.concept as string;
    const name = input.name as string;
    const typeExpr = input.typeExpr as string;
    const id = crypto.randomUUID();
    const key = `field:${concept}/${name}`;

    let p = createProgram();
    return complete(
      put(p, 'field', key, {
        id,
        concept,
        name,
        symbol: `clef/state/${concept}/${name}`,
        typeExpr: typeExpr || '',
        cardinality: typeExpr?.startsWith('set') ? 'set' : typeExpr?.includes('->') ? 'relation' : 'scalar',
        group: '',
        // Populated by syncs from GenerationProvenance/record
        generatedSymbols: '[]',
        // Populated by syncs from HandlerEntity/register
        storageMappings: '[]',
      }),
      'ok', { field: id },
    );
  },

  findByConcept(input) {
    const concept = input.concept as string;

    let p = createProgram();
    p = find(p, 'field', { concept }, 'matches');
    p = mapBindings(p, (b) => {
      const matches = b.matches as Array<Record<string, unknown>>;
      return JSON.stringify(matches.map(f => ({
        id: f.id, name: f.name, concept: f.concept, typeExpr: f.typeExpr,
      })));
    }, 'result');

    return pureFrom(p, (b) => ({ variant: 'ok', fields: b.result }));
  },

  traceToGenerated(input) {
    const fieldId = input.field as string;

    let p = createProgram();
    p = find(p, 'field', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      const entry = all.find(f => f.id === fieldId);
      return entry ? (entry.generatedSymbols as string || '[]') : '[]';
    }, 'targets');

    return pureFrom(p, (b) => ({ variant: 'ok', targets: b.targets }));
  },

  traceToStorage(input) {
    const fieldId = input.field as string;

    let p = createProgram();
    p = find(p, 'field', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      const entry = all.find(f => f.id === fieldId);
      return entry ? (entry.storageMappings as string || '[]') : '[]';
    }, 'targets');

    return pureFrom(p, (b) => ({ variant: 'ok', targets: b.targets }));
  },

  get(input) {
    const fieldId = input.field as string;

    let p = createProgram();
    p = find(p, 'field', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      return all.find(f => f.id === fieldId) || null;
    }, 'entry');

    return branch(p,
      (b) => b.entry != null,
      pureFrom(createProgram(), (b) => {
        const e = b.entry as Record<string, unknown>;
        return {
          variant: 'ok', field: e.id, concept: e.concept,
          name: e.name, typeExpr: e.typeExpr, cardinality: e.cardinality,
        };
      }),
      complete(createProgram(), 'notfound', {}),
    );
  },
};
