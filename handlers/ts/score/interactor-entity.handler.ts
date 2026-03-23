// @clef-handler style=functional
// ============================================================
// InteractorEntity Concept Implementation (Functional)
//
// Queryable representation of a registered interactor type —
// the abstract interaction taxonomy. Independent concept —
// widget/field matching data populated by syncs.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.js';
import {
  createProgram, find, put, branch, complete, completeFrom, pureFrom, mapBindings,
} from '../../../runtime/storage-program.js';

export const interactorEntityHandler: FunctionalConceptHandler = {

  register(input) {
    if (!input.name || (typeof input.name === 'string' && (input.name as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }
    const name = input.name as string;
    const category = input.category as string;
    const properties = input.properties as string;
    const id = crypto.randomUUID();
    const key = `interactor:${name}`;

    let p = createProgram();
    return complete(
      put(p, 'interactor', key, {
        id, name,
        symbol: `clef/interactor/${name}`,
        category: category || '',
        properties: properties || '{}',
        classificationRules: '[]',
        // Populated by syncs from WidgetEntity affordance matching
        matchingWidgetsCache: '[]',
        // Populated by syncs from StateField classification
        classifiedFieldsCache: '[]',
      }),
      'ok', { entity: id },
    );
  },

  findByCategory(input) {
    if (!input.category || (typeof input.category === 'string' && (input.category as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'category is required' }) as StorageProgram<Result>;
    }
    const category = input.category as string;

    let p = createProgram();
    p = find(p, 'interactor', { category }, 'matches');
    p = mapBindings(p, (b) => {
      const matches = b.matches as Array<Record<string, unknown>>;
      return JSON.stringify(matches.map(i => ({ id: i.id, name: i.name })));
    }, 'result');

    return completeFrom(p, 'ok', (b) => ({ interactors: b.result }));
  },

  matchingWidgets(input) {
    const interactor = input.interactor as string;

    let p = createProgram();
    p = find(p, 'interactor', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      const entry = all.find(i => i.id === interactor);
      return entry ? (entry.matchingWidgetsCache as string || '[]') : '[]';
    }, 'widgets');

    return completeFrom(p, 'ok', (b) => ({ widgets: b.widgets }));
  },

  classifiedFields(input) {
    const interactor = input.interactor as string;

    let p = createProgram();
    p = find(p, 'interactor', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      const entry = all.find(i => i.id === interactor);
      return entry ? (entry.classifiedFieldsCache as string || '[]') : '[]';
    }, 'fields');

    return completeFrom(p, 'ok', (b) => ({ fields: b.fields }));
  },

  coverageReport(input) {
    let p = createProgram();
    p = find(p, 'interactor', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      const report = all.map(i => {
        const widgets: unknown[] = JSON.parse(i.matchingWidgetsCache as string || '[]');
        return {
          interactor: i.name,
          widgetCount: widgets.length,
          uncoveredContexts: [],
        };
      });
      return JSON.stringify(report);
    }, 'report');

    return completeFrom(p, 'ok', (b) => ({ report: b.report }));
  },

  get(input) {
    const interactor = input.interactor as string;

    let p = createProgram();
    p = find(p, 'interactor', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      return all.find(i => i.id === interactor) || null;
    }, 'entry');

    return branch(p,
      (b) => b.entry != null,
      completeFrom(createProgram(), 'ok', (b) => {
        const e = b.entry as Record<string, unknown>;
        return {
          interactor: e.id, name: e.name,
          category: e.category, properties: e.properties,
        };
      }),
      complete(createProgram(), 'notfound', {}),
    );
  },
};
