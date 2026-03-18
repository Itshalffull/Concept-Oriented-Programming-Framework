// ============================================================
// ConceptEntity Concept Implementation (Functional)
//
// Queryable representation of a parsed concept, linking its
// declaration to generated artifacts and runtime behavior.
// Each concept entity is independent — cross-concept data
// (syncs, artifacts) is populated by syncs, not direct queries.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.js';
import {
  createProgram, get, find, put, branch, complete, pureFrom, mapBindings,
} from '../../../runtime/storage-program.js';

export const conceptEntityHandler: FunctionalConceptHandler = {

  register(input) {
    const name = input.name as string;
    const source = input.source as string;
    const ast = input.ast as string;
    const id = crypto.randomUUID();
    const parsed = ast ? JSON.parse(ast) : {};
    const key = `concept:${name}`;

    let p = createProgram();
    p = get(p, 'entity', key, 'existing');

    return branch(p,
      (b) => b.existing != null,
      complete(createProgram(), 'alreadyRegistered', { existing: key }),
      complete(
        put(createProgram(), 'entity', key, {
          id,
          name,
          symbol: `clef/concept/${name}`,
          sourceFile: source,
          purposeText: parsed.purpose || '',
          version: parsed.version || 1,
          gate: parsed.gate || '',
          capabilitiesList: JSON.stringify(parsed.capabilities || []),
          typeParams: JSON.stringify(parsed.typeParams || []),
          actionsRef: JSON.stringify(parsed.actions || []),
          stateFieldsRef: JSON.stringify(parsed.state || []),
          suite: parsed.suite || '',
          // Populated by syncs when SyncEntity/register fires
          participatingSyncsCache: '[]',
          // Populated by syncs when GenerationProvenance/record fires
          generatedArtifactsCache: '[]',
        }),
        'ok', { entity: id },
      ),
    );
  },

  get(input) {
    const name = input.name as string;
    const key = `concept:${name}`;

    let p = createProgram();
    p = get(p, 'entity', key, 'existing');

    return branch(p,
      (b) => b.existing != null,
      pureFrom(createProgram(), (b) => ({
        variant: 'ok',
        entity: (b.existing as Record<string, unknown>).id,
      })),
      complete(createProgram(), 'notfound', {}),
    );
  },

  findByCapability(input) {
    const capability = input.capability as string;

    let p = createProgram();
    p = find(p, 'entity', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      return JSON.stringify(
        all
          .filter(e => {
            const caps: string[] = JSON.parse(e.capabilitiesList as string || '[]');
            return caps.includes(capability);
          })
          .map(e => e.name),
      );
    }, 'result');

    return pureFrom(p, (b) => ({ variant: 'ok', entities: b.result }));
  },

  findBySuite(input) {
    const suite = input.suite as string;

    let p = createProgram();
    p = find(p, 'entity', { suite }, 'matches');
    p = mapBindings(p, (b) => {
      const matches = b.matches as Array<Record<string, unknown>>;
      return JSON.stringify(matches.map(e => e.name));
    }, 'result');

    return pureFrom(p, (b) => ({ variant: 'ok', entities: b.result }));
  },

  generatedArtifacts(input) {
    const entity = input.entity as string;

    // Read from own storage — cache populated by GenerationProvenance sync
    let p = createProgram();
    p = find(p, 'entity', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      const entry = all.find(e => e.id === entity);
      return entry ? (entry.generatedArtifactsCache as string || '[]') : '[]';
    }, 'artifacts');

    return pureFrom(p, (b) => ({ variant: 'ok', artifacts: b.artifacts }));
  },

  participatingSyncs(input) {
    const entity = input.entity as string;

    // Read from own storage — cache populated by SyncEntity/register sync
    let p = createProgram();
    p = find(p, 'entity', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      const entry = all.find(e => e.id === entity);
      return entry ? (entry.participatingSyncsCache as string || '[]') : '[]';
    }, 'syncs');

    return pureFrom(p, (b) => ({ variant: 'ok', syncs: b.syncs }));
  },

  checkCompatibility(input) {
    const aId = input.a as string;
    const bId = input.b as string;

    let p = createProgram();
    p = find(p, 'entity', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      const a = all.find(e => e.id === aId);
      const bEntry = all.find(e => e.id === bId);
      if (!a || !bEntry) return { compatible: false, reason: 'One or both concepts not found' };

      const aParams: string[] = JSON.parse(a.typeParams as string || '[]');
      const bParams: string[] = JSON.parse(bEntry.typeParams as string || '[]');
      const shared = aParams.filter(p => bParams.includes(p));

      return shared.length > 0
        ? { compatible: true, sharedTypeParams: JSON.stringify(shared) }
        : { compatible: false, reason: 'No shared type parameters' };
    }, 'result');

    return branch(p,
      (b) => (b.result as Record<string, unknown>).compatible === true,
      pureFrom(createProgram(), (b) => ({
        variant: 'compatible',
        sharedTypeParams: (b.result as Record<string, unknown>).sharedTypeParams,
      })),
      pureFrom(createProgram(), (b) => ({
        variant: 'incompatible',
        reason: (b.result as Record<string, unknown>).reason,
      })),
    );
  },
};
