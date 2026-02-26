// ============================================================
// Score Auto-Bootstrap
//
// Registers Score as a built-in concept in every Clef runtime.
// Called by the kernel during boot, before any user concepts
// are registered. This ensures Score is available for LLM
// tool-use queries from the moment the app starts.
//
// Score is lightweight — it uses in-process transport and
// in-memory storage. The ScoreApi facade delegates to ScoreIndex
// for materialized data and to the underlying Score kit concepts
// for complex queries.
// ============================================================

import type { ConceptHandler, ConceptRegistry, CompiledSync } from './types.js';
import { createInMemoryStorage } from './storage.js';
import { createInProcessAdapter } from './transport.js';

const SCORE_API_URI = 'urn:clef/ScoreApi';
const SCORE_INDEX_URI = 'urn:clef/ScoreIndex';

/**
 * Compiled sync definitions for Score auto-registration.
 * These fire on action completions to keep the Score index
 * up to date as the app runs.
 */
function createScoreIndexSyncs(): CompiledSync[] {
  return [
    // Index concepts when SpecParser parses .concept files
    {
      name: 'ScoreIndexOnParseConceptSync',
      annotation: 'eager',
      patterns: [
        {
          concept: 'urn:clef/ConceptEntity',
          action: 'register',
          inputBindings: { name: '?name', source: '?file', ast: '?ast' },
          outputBindings: { entity: '?entity' },
        },
      ],
      whereClause: [],
      thenClause: [
        {
          concept: SCORE_INDEX_URI,
          action: 'upsertConcept',
          bindings: {
            name: '?name',
            purpose: '?ast.purpose',
            actions: '?ast.actionNames',
            stateFields: '?ast.fieldNames',
            file: '?file',
          },
        },
      ],
    },

    // Index syncs when SyncParser parses .sync files
    {
      name: 'ScoreIndexOnParseSyncSync',
      annotation: 'eager',
      patterns: [
        {
          concept: 'urn:clef/SyncEntity',
          action: 'register',
          inputBindings: { name: '?name', source: '?file' },
          outputBindings: { entity: '?entity' },
        },
      ],
      whereClause: [],
      thenClause: [
        {
          concept: SCORE_INDEX_URI,
          action: 'upsertSync',
          bindings: {
            name: '?name',
            annotation: '?entity.annotation',
            triggers: '?entity.triggers',
            effects: '?entity.effects',
            file: '?file',
          },
        },
      ],
    },

    // Index symbols when Symbol concept extracts them
    {
      name: 'ScoreIndexOnSymbolSync',
      annotation: 'eager',
      patterns: [
        {
          concept: 'urn:clef/Symbol',
          action: 'register',
          inputBindings: { name: '?name', kind: '?kind', file: '?file', line: '?line', scope: '?scope' },
          outputBindings: { symbol: '?symbol' },
        },
      ],
      whereClause: [],
      thenClause: [
        {
          concept: SCORE_INDEX_URI,
          action: 'upsertSymbol',
          bindings: {
            name: '?name',
            kind: '?kind',
            file: '?file',
            line: '?line',
            scope: '?scope',
          },
        },
      ],
    },

    // Index files when FileArtifact registers them
    {
      name: 'ScoreIndexOnFileSync',
      annotation: 'eager',
      patterns: [
        {
          concept: 'urn:clef/FileArtifact',
          action: 'register',
          inputBindings: { path: '?path', language: '?lang', role: '?role' },
          outputBindings: { artifact: '?artifact' },
        },
      ],
      whereClause: [],
      thenClause: [
        {
          concept: SCORE_INDEX_URI,
          action: 'upsertFile',
          bindings: {
            path: '?path',
            language: '?lang',
            role: '?role',
            definitions: '?artifact.definitions',
          },
        },
      ],
    },
  ];
}

/**
 * Bootstrap Score into a Clef runtime.
 *
 * Call this during kernel initialization, after the SyncEngine
 * is registered but before user concepts are loaded. Score
 * concepts use the shared registry for transport resolution
 * and the shared sync engine for indexing syncs.
 *
 * @param registry - The shared ConceptRegistry
 * @param scoreApiHandler - The ScoreApi concept handler
 * @param scoreIndexHandler - The ScoreIndex concept handler
 * @param registerSync - Callback to register compiled syncs with the engine
 */
export function bootstrapScore(
  registry: ConceptRegistry,
  scoreApiHandler: ConceptHandler,
  scoreIndexHandler: ConceptHandler,
  registerSync: (sync: CompiledSync) => void,
): void {
  // Create shared storage instances (Score concepts share
  // a single index store via the ScoreApi → ScoreIndex delegation)
  const scoreIndexStorage = createInMemoryStorage();
  const scoreApiStorage = scoreIndexStorage; // Shared: ScoreApi reads from ScoreIndex's storage

  // Register Score concepts with in-process transport
  registry.register(SCORE_API_URI, createInProcessAdapter(scoreApiHandler, scoreApiStorage));
  registry.register(SCORE_INDEX_URI, createInProcessAdapter(scoreIndexHandler, scoreIndexStorage));

  // Register Score indexing syncs
  const syncs = createScoreIndexSyncs();
  for (const sync of syncs) {
    registerSync(sync);
  }
}

/**
 * Check if Score is already registered in the given registry.
 */
export function isScoreRegistered(registry: ConceptRegistry): boolean {
  const transport = registry.resolve(SCORE_API_URI);
  return transport !== undefined && transport !== null;
}

export { SCORE_API_URI, SCORE_INDEX_URI };
