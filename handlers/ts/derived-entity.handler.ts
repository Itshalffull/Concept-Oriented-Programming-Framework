// ============================================================
// DerivedEntity Handler
//
// Queryable representation of a parsed .derived file — enables
// trace rollup by linking derivedContext tags to composition
// hierarchies, and queries like "what concepts compose this
// derived concept?" and "what syncs wire it together?"
// ============================================================

import type { ConceptHandler, ConceptStorage, DerivedAST } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `derived-entity-${++idCounter}`;
}

export const derivedEntityHandler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    const name = input.name as string;
    const source = input.source as string;
    const ast = input.ast as string;

    // Check for duplicate by name
    const existing = await storage.find('derived-entity', { name });
    if (existing.length > 0) {
      return { variant: 'alreadyRegistered', existing: existing[0].id as string };
    }

    const id = nextId();
    const symbol = `clef/derived/${name}`;

    // Extract metadata from DerivedAST
    let purposeText = '';
    let composesRefs = '[]';
    let requiredSyncs = '[]';
    let surfaceActions = '[]';
    let surfaceQueries = '[]';
    let principle = '';

    try {
      const parsed: DerivedAST = JSON.parse(ast);
      purposeText = parsed.purpose || '';
      composesRefs = JSON.stringify(parsed.composes || []);
      requiredSyncs = JSON.stringify(parsed.syncs?.required || []);
      surfaceActions = JSON.stringify(parsed.surface?.actions || []);
      surfaceQueries = JSON.stringify(parsed.surface?.queries || []);
      principle = parsed.principle ? JSON.stringify(parsed.principle) : '';
    } catch {
      // AST may be empty or non-JSON; store defaults
    }

    await storage.put('derived-entity', id, {
      id,
      name,
      symbol,
      sourceFile: source,
      ast,
      purposeText,
      composesRefs,
      requiredSyncs,
      surfaceActions,
      surfaceQueries,
      principle,
    });

    return { variant: 'ok', entity: id };
  },

  async get(input: Record<string, unknown>, storage: ConceptStorage) {
    const name = input.name as string;

    const results = await storage.find('derived-entity', { name });
    if (results.length === 0) {
      return { variant: 'notfound' };
    }

    return { variant: 'ok', entity: results[0].id as string };
  },

  async findByComposedConcept(input: Record<string, unknown>, storage: ConceptStorage) {
    const concept = input.concept as string;

    const allDerived = await storage.find('derived-entity');
    const matching = allDerived.filter((d) => {
      try {
        const composes = JSON.parse(d.composesRefs as string || '[]');
        return composes.some(
          (c: Record<string, unknown> | string) =>
            (typeof c === 'string' && c === concept) ||
            (typeof c === 'object' && c.name === concept),
        );
      } catch {
        return false;
      }
    });

    return { variant: 'ok', entities: JSON.stringify(matching) };
  },

  async findBySync(input: Record<string, unknown>, storage: ConceptStorage) {
    const syncName = input.syncName as string;

    const allDerived = await storage.find('derived-entity');
    const matching = allDerived.filter((d) => {
      try {
        const syncs = JSON.parse(d.requiredSyncs as string || '[]');
        return syncs.includes(syncName);
      } catch {
        return false;
      }
    });

    return { variant: 'ok', entities: JSON.stringify(matching) };
  },

  async compositionTree(input: Record<string, unknown>, storage: ConceptStorage) {
    const entity = input.entity as string;

    const record = await storage.get('derived-entity', entity);
    if (!record) {
      return { variant: 'notfound' };
    }

    // Build recursive tree: for each composed entry, if it's a derived
    // concept, recurse to build its subtree
    const composes = JSON.parse(record.composesRefs as string || '[]');
    const tree: Record<string, unknown>[] = [];

    for (const entry of composes) {
      const entryName = typeof entry === 'string' ? entry : (entry.name as string);
      const isDerived = typeof entry === 'object' && entry.isDerived;

      if (isDerived) {
        const childResults = await storage.find('derived-entity', { name: entryName });
        if (childResults.length > 0) {
          const childTree = await this.compositionTree(
            { entity: childResults[0].id as string },
            storage,
          );
          tree.push({
            name: entryName,
            type: 'derived',
            children: childTree.variant === 'ok' ? JSON.parse(childTree.tree as string) : [],
          });
        } else {
          tree.push({ name: entryName, type: 'derived', children: [] });
        }
      } else {
        tree.push({ name: entryName, type: 'concept' });
      }
    }

    return { variant: 'ok', tree: JSON.stringify(tree) };
  },

  async traceRollup(input: Record<string, unknown>, storage: ConceptStorage) {
    const entity = input.entity as string;
    const flowId = input.flowId as string;

    const record = await storage.get('derived-entity', entity);
    if (!record) {
      return { variant: 'notfound' };
    }

    // Look up flow trace records and group by claimed sync
    const claimedSyncs = JSON.parse(record.requiredSyncs as string || '[]');
    const flowRecords = await storage.find('action-log', { flow: flowId });

    const grouped: Record<string, Record<string, unknown>[]> = {};
    for (const syncName of claimedSyncs) {
      grouped[syncName] = flowRecords.filter((r) => r.sync === syncName);
    }

    const unclaimed = flowRecords.filter(
      (r) => r.sync && !claimedSyncs.includes(r.sync),
    );

    return {
      variant: 'ok',
      rollup: JSON.stringify({
        derivedConcept: record.name,
        claimedSyncs: grouped,
        unclaimedActions: unclaimed.length,
        totalActions: flowRecords.length,
      }),
    };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetDerivedEntityCounter(): void {
  idCounter = 0;
}
