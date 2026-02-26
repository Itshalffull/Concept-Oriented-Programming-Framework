// ============================================================
// ConceptEntity Handler
//
// Queryable representation of a parsed concept, linking its
// declaration to generated artifacts and runtime behavior. Enables
// semantic queries like "what syncs participate in this concept?"
// and "what artifacts were generated from it?"
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `concept-entity-${++idCounter}`;
}

export const conceptEntityHandler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    const name = input.name as string;
    const source = input.source as string;
    const ast = input.ast as string;

    // Check for duplicate by name
    const existing = await storage.find('concept-entity', { name });
    if (existing.length > 0) {
      return { variant: 'alreadyRegistered', existing: existing[0].id as string };
    }

    const id = nextId();
    const symbol = `clef/concept/${name}`;

    // Extract metadata from AST if possible
    let purposeText = '';
    let version = 0;
    let gate = 'false';
    let capabilitiesList = '[]';
    let typeParams = '[]';
    let actionsRef = '[]';
    let stateFieldsRef = '[]';
    let kit = '';

    try {
      const parsed = JSON.parse(ast);
      purposeText = parsed.purpose || '';
      version = parsed.version || 0;
      gate = parsed.annotations?.gate ? 'true' : 'false';
      capabilitiesList = JSON.stringify(parsed.capabilities || []);
      typeParams = JSON.stringify(parsed.typeParams || []);
      actionsRef = JSON.stringify((parsed.actions || []).map((a: Record<string, unknown>) => a.name));
      stateFieldsRef = JSON.stringify((parsed.state || []).map((s: Record<string, unknown>) => s.name));
      kit = parsed.kit || '';
    } catch {
      // AST may be empty or non-JSON; store defaults
    }

    await storage.put('concept-entity', id, {
      id,
      name,
      symbol,
      sourceFile: source,
      purposeText,
      version,
      gate,
      capabilitiesList,
      typeParams,
      actionsRef,
      stateFieldsRef,
      kit,
    });

    return { variant: 'ok', entity: id };
  },

  async get(input: Record<string, unknown>, storage: ConceptStorage) {
    const name = input.name as string;

    const results = await storage.find('concept-entity', { name });
    if (results.length === 0) {
      return { variant: 'notfound' };
    }

    return { variant: 'ok', entity: results[0].id as string };
  },

  async findByCapability(input: Record<string, unknown>, storage: ConceptStorage) {
    const capability = input.capability as string;

    const allEntities = await storage.find('concept-entity');
    const matching = allEntities.filter((e) => {
      try {
        const caps = JSON.parse(e.capabilitiesList as string || '[]');
        return Array.isArray(caps) && caps.includes(capability);
      } catch {
        return false;
      }
    });

    return { variant: 'ok', entities: JSON.stringify(matching) };
  },

  async findByKit(input: Record<string, unknown>, storage: ConceptStorage) {
    const kit = input.kit as string;

    const results = await storage.find('concept-entity', { kit });

    return { variant: 'ok', entities: JSON.stringify(results) };
  },

  async generatedArtifacts(input: Record<string, unknown>, storage: ConceptStorage) {
    const entity = input.entity as string;

    const record = await storage.get('concept-entity', entity);
    if (!record) {
      return { variant: 'ok', artifacts: '[]' };
    }

    // Look up provenance records for this concept's symbol
    const artifacts = await storage.find('provenance', { sourceSymbol: record.symbol });
    return { variant: 'ok', artifacts: JSON.stringify(artifacts) };
  },

  async participatingSyncs(input: Record<string, unknown>, storage: ConceptStorage) {
    const entity = input.entity as string;

    const record = await storage.get('concept-entity', entity);
    if (!record) {
      return { variant: 'ok', syncs: '[]' };
    }

    const conceptName = record.name as string;

    // Search all sync entities for references to this concept
    const allSyncs = await storage.find('sync-entity');
    const matching = allSyncs.filter((s) => {
      try {
        const compiled = JSON.parse(s.compiled as string || '{}');
        const whenRefs = (compiled.when || []).some(
          (w: Record<string, unknown>) => w.concept === conceptName,
        );
        const thenRefs = (compiled.then || []).some(
          (t: Record<string, unknown>) => t.concept === conceptName,
        );
        return whenRefs || thenRefs;
      } catch {
        return false;
      }
    });

    return { variant: 'ok', syncs: JSON.stringify(matching) };
  },

  async checkCompatibility(input: Record<string, unknown>, storage: ConceptStorage) {
    const a = input.a as string;
    const b = input.b as string;

    const recordA = await storage.get('concept-entity', a);
    const recordB = await storage.get('concept-entity', b);

    if (!recordA || !recordB) {
      return { variant: 'incompatible', reason: 'One or both concept entities not found' };
    }

    try {
      const typeParamsA = JSON.parse(recordA.typeParams as string || '[]') as string[];
      const typeParamsB = JSON.parse(recordB.typeParams as string || '[]') as string[];

      const shared = typeParamsA.filter((tp: string) => typeParamsB.includes(tp));

      if (shared.length > 0) {
        return { variant: 'compatible', sharedTypeParams: JSON.stringify(shared) };
      }

      // If no shared type params but no conflicts either, they are compatible
      const capsA = JSON.parse(recordA.capabilitiesList as string || '[]') as string[];
      const capsB = JSON.parse(recordB.capabilitiesList as string || '[]') as string[];

      // Check for conflicting capabilities
      const conflicts = capsA.filter((c: string) => capsB.includes(c) && c.startsWith('exclusive-'));
      if (conflicts.length > 0) {
        return {
          variant: 'incompatible',
          reason: `Conflicting exclusive capabilities: ${JSON.stringify(conflicts)}`,
        };
      }

      return { variant: 'compatible', sharedTypeParams: '[]' };
    } catch {
      return { variant: 'incompatible', reason: 'Failed to parse type parameters' };
    }
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetConceptEntityCounter(): void {
  idCounter = 0;
}
