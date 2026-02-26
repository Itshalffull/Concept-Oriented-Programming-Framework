// ============================================================
// ActionEntity Handler
//
// Action declaration with full lifecycle tracing from spec through
// sync participation, implementation, interface exposure, to
// runtime invocation. Enables queries like "what syncs trigger on
// this action?" and "where is this action implemented?"
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `action-entity-${++idCounter}`;
}

export const actionEntityHandler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    const concept = input.concept as string;
    const name = input.name as string;
    const params = input.params as string;
    const variantRefs = input.variantRefs as string;

    // Check for duplicate by concept + name
    const existing = await storage.find('action-entity', { concept, name });
    if (existing.length > 0) {
      return { variant: 'ok', action: existing[0].id as string };
    }

    const id = nextId();
    const symbol = `clef/action/${concept}/${name}`;
    let variantCount = 0;
    try {
      const parsed = JSON.parse(variantRefs);
      variantCount = Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      variantCount = 0;
    }

    await storage.put('action-entity', id, {
      id,
      concept,
      name,
      symbol,
      params,
      variantRefs,
      variantCount,
      implementationSymbols: '[]',
    });

    return { variant: 'ok', action: id };
  },

  async findByConcept(input: Record<string, unknown>, storage: ConceptStorage) {
    const concept = input.concept as string;

    const criteria: Record<string, unknown> = {};
    if (concept !== undefined && concept !== '') criteria.concept = concept;
    const results = await storage.find('action-entity', Object.keys(criteria).length > 0 ? criteria : undefined);

    return { variant: 'ok', actions: JSON.stringify(results) };
  },

  async triggeringSyncs(input: Record<string, unknown>, storage: ConceptStorage) {
    const action = input.action as string;

    // Look up the action entity to get concept + name
    const actionRecord = await storage.get('action-entity', action);
    if (!actionRecord) {
      return { variant: 'ok', syncs: '[]' };
    }

    // Search sync-entity for syncs whose compiled whenPatterns reference this action
    const allSyncs = await storage.find('sync-entity');
    const matching = allSyncs.filter((s) => {
      try {
        const compiled = JSON.parse(s.compiled as string || '{}');
        const whenPatterns = compiled.when || [];
        return whenPatterns.some(
          (w: Record<string, unknown>) =>
            w.concept === actionRecord.concept && w.action === actionRecord.name,
        );
      } catch {
        return false;
      }
    });

    return { variant: 'ok', syncs: JSON.stringify(matching) };
  },

  async invokingSyncs(input: Record<string, unknown>, storage: ConceptStorage) {
    const action = input.action as string;

    // Look up the action entity to get concept + name
    const actionRecord = await storage.get('action-entity', action);
    if (!actionRecord) {
      return { variant: 'ok', syncs: '[]' };
    }

    // Search sync-entity for syncs whose compiled thenActions reference this action
    const allSyncs = await storage.find('sync-entity');
    const matching = allSyncs.filter((s) => {
      try {
        const compiled = JSON.parse(s.compiled as string || '{}');
        const thenActions = compiled.then || [];
        return thenActions.some(
          (t: Record<string, unknown>) =>
            t.concept === actionRecord.concept && t.action === actionRecord.name,
        );
      } catch {
        return false;
      }
    });

    return { variant: 'ok', syncs: JSON.stringify(matching) };
  },

  async implementations(input: Record<string, unknown>, storage: ConceptStorage) {
    const action = input.action as string;

    const record = await storage.get('action-entity', action);
    if (!record) {
      return { variant: 'ok', symbols: '[]' };
    }

    return { variant: 'ok', symbols: (record.implementationSymbols as string) || '[]' };
  },

  async interfaceExposures(input: Record<string, unknown>, storage: ConceptStorage) {
    const action = input.action as string;

    const record = await storage.get('action-entity', action);
    if (!record) {
      return { variant: 'ok', exposures: '[]' };
    }

    // Look up any interface-exposure records referencing this action's symbol
    const exposures = await storage.find('interface-exposure', { actionSymbol: record.symbol });
    return { variant: 'ok', exposures: JSON.stringify(exposures) };
  },

  async get(input: Record<string, unknown>, storage: ConceptStorage) {
    const action = input.action as string;

    const record = await storage.get('action-entity', action);
    if (!record) {
      return { variant: 'notfound' };
    }

    return {
      variant: 'ok',
      action: record.id as string,
      concept: record.concept as string,
      name: record.name as string,
      params: record.params as string,
      variantCount: (record.variantCount as number) || 0,
    };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetActionEntityCounter(): void {
  idCounter = 0;
}
