// @clef-handler style=functional
// ============================================================
// DerivedEntity Concept Implementation (Functional)
//
// Queryable representation of a parsed derived concept — a named
// composition of base concepts and syncs. Independent concept —
// only queries own storage for composition tree traversal.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.js';
import {
  createProgram, get, find, put, branch, complete, pureFrom, mapBindings,
} from '../../../runtime/storage-program.js';

export const derivedEntityHandler: FunctionalConceptHandler = {

  register(input) {
    const name = input.name as string;
    const source = input.source as string;
    const ast = input.ast as string;
    const id = crypto.randomUUID();
    const key = `derived:${name}`;
    const parsed = ast ? JSON.parse(ast) : {};

    let p = createProgram();
    p = get(p, 'derived', key, 'existing');

    return branch(p,
      (b) => b.existing != null,
      complete(createProgram(), 'alreadyRegistered', { existing: key }),
      complete(
        put(createProgram(), 'derived', key, {
          id,
          name,
          symbol: `clef/derived/${name}`,
          sourceFile: source,
          purposeText: parsed.purpose || '',
          composesRefs: JSON.stringify(parsed.composes || []),
          requiredSyncs: JSON.stringify(parsed.requiredSyncs || []),
          surfaceActions: JSON.stringify(parsed.surfaceActions || []),
          surfaceQueries: JSON.stringify(parsed.surfaceQueries || []),
          principle: parsed.principle || '',
          suite: parsed.suite || '',
        }),
        'ok', { entity: id },
      ),
    );
  },

  get(input) {
    const name = input.name as string;
    const key = `derived:${name}`;

    let p = createProgram();
    p = get(p, 'derived', key, 'existing');

    return branch(p,
      (b) => b.existing != null,
      pureFrom(createProgram(), (b) => ({
        variant: 'ok',
        entity: (b.existing as Record<string, unknown>).id,
      })),
      complete(createProgram(), 'notfound', {}),
    );
  },

  findByComposedConcept(input) {
    const concept = input.concept as string;

    let p = createProgram();
    p = find(p, 'derived', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      const matching = all.filter(d => {
        const composes: Array<string | { name?: string }> = JSON.parse(d.composesRefs as string || '[]');
        return composes.some(c => (typeof c === 'string' ? c : c.name) === concept);
      });
      return JSON.stringify(matching.map(d => ({ id: d.id, name: d.name })));
    }, 'result');

    return pureFrom(p, (b) => ({ variant: 'ok', entities: b.result }));
  },

  findBySync(input) {
    const syncName = input.syncName as string;

    let p = createProgram();
    p = find(p, 'derived', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      const matching = all.filter(d => {
        const syncs: Array<string | { name?: string }> = JSON.parse(d.requiredSyncs as string || '[]');
        return syncs.some(s => (typeof s === 'string' ? s : s.name) === syncName);
      });
      return JSON.stringify(matching.map(d => ({ id: d.id, name: d.name })));
    }, 'result');

    return pureFrom(p, (b) => ({ variant: 'ok', entities: b.result }));
  },

  compositionTree(input) {
    const entity = input.entity as string;

    let p = createProgram();
    p = find(p, 'derived', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      const entry = all.find(d => d.id === entity);
      if (!entry) return null;

      const tree = {
        name: entry.name,
        composes: JSON.parse(entry.composesRefs as string || '[]'),
        syncs: JSON.parse(entry.requiredSyncs as string || '[]'),
        children: [] as Array<Record<string, unknown>>,
      };

      // Recursively find composed derived concepts (within own storage)
      for (const composed of tree.composes) {
        const composedName = typeof composed === 'string' ? composed : composed.name;
        const child = all.find(d => d.name === composedName);
        if (child) {
          tree.children.push({
            name: child.name,
            composes: JSON.parse(child.composesRefs as string || '[]'),
            syncs: JSON.parse(child.requiredSyncs as string || '[]'),
          });
        }
      }

      return tree;
    }, 'tree');

    return branch(p,
      (b) => b.tree != null,
      pureFrom(createProgram(), (b) => ({ variant: 'ok', tree: JSON.stringify(b.tree) })),
      complete(createProgram(), 'notfound', {}),
    );
  },

  traceRollup(input) {
    const entity = input.entity as string;
    const flowId = input.flowId as string;

    let p = createProgram();
    p = find(p, 'derived', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      const entry = all.find(d => d.id === entity);
      if (!entry) return null;

      // Rollup structure — runtime flow correlation done via syncs
      return { derived: entry.name, flowId, composedFlows: [] };
    }, 'rollup');

    return branch(p,
      (b) => b.rollup != null,
      pureFrom(createProgram(), (b) => ({ variant: 'ok', rollup: JSON.stringify(b.rollup) })),
      complete(createProgram(), 'notfound', {}),
    );
  },
};
