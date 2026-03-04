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
import { createInMemoryStorage } from './adapters/storage.js';
import { createInProcessAdapter } from './adapters/transport.js';

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
      annotations: ['eager'],
      when: [
        {
          concept: 'urn:clef/ConceptEntity',
          action: 'register',
          inputFields: [
            { name: 'name', match: { type: 'variable', name: 'name' } },
            { name: 'source', match: { type: 'variable', name: 'file' } },
            { name: 'ast', match: { type: 'variable', name: 'ast' } },
          ],
          outputFields: [
            { name: 'entity', match: { type: 'variable', name: 'entity' } },
          ],
        },
      ],
      where: [],
      then: [
        {
          concept: SCORE_INDEX_URI,
          action: 'upsertConcept',
          fields: [
            { name: 'name', value: { type: 'variable', name: 'name' } },
            { name: 'purpose', value: { type: 'variable', name: 'ast.purpose' } },
            { name: 'actions', value: { type: 'variable', name: 'ast.actionNames' } },
            { name: 'stateFields', value: { type: 'variable', name: 'ast.fieldNames' } },
            { name: 'file', value: { type: 'variable', name: 'file' } },
          ],
        },
      ],
    },

    // Index syncs when SyncParser parses .sync files
    {
      name: 'ScoreIndexOnParseSyncSync',
      annotations: ['eager'],
      when: [
        {
          concept: 'urn:clef/SyncEntity',
          action: 'register',
          inputFields: [
            { name: 'name', match: { type: 'variable', name: 'name' } },
            { name: 'source', match: { type: 'variable', name: 'file' } },
          ],
          outputFields: [
            { name: 'entity', match: { type: 'variable', name: 'entity' } },
          ],
        },
      ],
      where: [],
      then: [
        {
          concept: SCORE_INDEX_URI,
          action: 'upsertSync',
          fields: [
            { name: 'name', value: { type: 'variable', name: 'name' } },
            { name: 'annotation', value: { type: 'variable', name: 'entity.annotation' } },
            { name: 'triggers', value: { type: 'variable', name: 'entity.triggers' } },
            { name: 'effects', value: { type: 'variable', name: 'entity.effects' } },
            { name: 'file', value: { type: 'variable', name: 'file' } },
          ],
        },
      ],
    },

    // Index symbols when Symbol concept extracts them
    {
      name: 'ScoreIndexOnSymbolSync',
      annotations: ['eager'],
      when: [
        {
          concept: 'urn:clef/Symbol',
          action: 'register',
          inputFields: [
            { name: 'name', match: { type: 'variable', name: 'name' } },
            { name: 'kind', match: { type: 'variable', name: 'kind' } },
            { name: 'file', match: { type: 'variable', name: 'file' } },
            { name: 'line', match: { type: 'variable', name: 'line' } },
            { name: 'scope', match: { type: 'variable', name: 'scope' } },
          ],
          outputFields: [
            { name: 'symbol', match: { type: 'variable', name: 'symbol' } },
          ],
        },
      ],
      where: [],
      then: [
        {
          concept: SCORE_INDEX_URI,
          action: 'upsertSymbol',
          fields: [
            { name: 'name', value: { type: 'variable', name: 'name' } },
            { name: 'kind', value: { type: 'variable', name: 'kind' } },
            { name: 'file', value: { type: 'variable', name: 'file' } },
            { name: 'line', value: { type: 'variable', name: 'line' } },
            { name: 'scope', value: { type: 'variable', name: 'scope' } },
          ],
        },
      ],
    },

    // Index files when FileArtifact registers them
    {
      name: 'ScoreIndexOnFileSync',
      annotations: ['eager'],
      when: [
        {
          concept: 'urn:clef/FileArtifact',
          action: 'register',
          inputFields: [
            { name: 'path', match: { type: 'variable', name: 'path' } },
            { name: 'language', match: { type: 'variable', name: 'lang' } },
            { name: 'role', match: { type: 'variable', name: 'role' } },
          ],
          outputFields: [
            { name: 'artifact', match: { type: 'variable', name: 'artifact' } },
          ],
        },
      ],
      where: [],
      then: [
        {
          concept: SCORE_INDEX_URI,
          action: 'upsertFile',
          fields: [
            { name: 'path', value: { type: 'variable', name: 'path' } },
            { name: 'language', value: { type: 'variable', name: 'lang' } },
            { name: 'role', value: { type: 'variable', name: 'role' } },
            { name: 'definitions', value: { type: 'variable', name: 'artifact.definitions' } },
          ],
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
