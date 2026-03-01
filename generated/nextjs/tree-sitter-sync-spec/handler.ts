// Tree-sitter grammar for .sync spec files — CST parsing for sync definitions.
// Registers node types for sync pairs, conflict resolution strategies, and replica topology.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  TreeSitterSyncSpecStorage,
  TreeSitterSyncSpecInitializeInput,
  TreeSitterSyncSpecInitializeOutput,
} from './types.js';

import {
  initializeOk,
  initializeLoadError,
} from './types.js';

export interface TreeSitterSyncSpecError {
  readonly code: string;
  readonly message: string;
}

export interface TreeSitterSyncSpecHandler {
  readonly initialize: (
    input: TreeSitterSyncSpecInitializeInput,
    storage: TreeSitterSyncSpecStorage,
  ) => TE.TaskEither<TreeSitterSyncSpecError, TreeSitterSyncSpecInitializeOutput>;
}

// --- Pure helpers ---

/** Node types recognized in .sync grammar */
const SYNC_NODE_TYPES: readonly string[] = [
  'source_file',
  'sync_declaration',
  'sync_name',
  'sync_pair_block',
  'sync_pair',
  'source_field',
  'target_field',
  'conflict_resolution_block',
  'resolution_strategy',
  'lww_resolution',
  'add_wins_resolution',
  'manual_resolution',
  'multi_value_resolution',
  'replica_block',
  'replica_declaration',
  'causal_clock_ref',
  'merge_strategy',
  'field_mapping',
  'transform_expression',
  'annotation',
  'comment',
  'identifier',
  'string_literal',
] as const;

/** Sync-specific resolution strategies the grammar must support */
const REQUIRED_RESOLUTION_TYPES: readonly string[] = [
  'lww_resolution',
  'add_wins_resolution',
  'manual_resolution',
  'multi_value_resolution',
] as const;

/** Validate that all resolution strategies are present in node types */
const validateResolutionCoverage = (
  nodeTypes: readonly string[],
): O.Option<string> => {
  const nodeSet = new Set(nodeTypes);
  const missing = REQUIRED_RESOLUTION_TYPES.filter((r) => !nodeSet.has(r));
  return missing.length > 0
    ? O.some(`Missing resolution strategy node types: ${missing.join(', ')}`)
    : O.none;
};

const toStorageError = (error: unknown): TreeSitterSyncSpecError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const treeSitterSyncSpecHandler: TreeSitterSyncSpecHandler = {
  initialize: (_input, storage) =>
    pipe(
      validateResolutionCoverage(SYNC_NODE_TYPES),
      O.fold(
        () =>
          pipe(
            TE.tryCatch(
              async () => {
                const instanceId = `sync-spec-grammar-${Date.now()}`;

                await storage.put('grammars', instanceId, {
                  instanceId,
                  language: 'sync-spec',
                  version: '1.0.0',
                  fileExtensions: ['.sync'],
                  rootNode: 'source_file',
                  nodeTypeCount: SYNC_NODE_TYPES.length,
                  supportsCRDT: true,
                  supportedResolutions: [...REQUIRED_RESOLUTION_TYPES],
                  initializedAt: new Date().toISOString(),
                });

                // Register node types with structural categorization
                const structuralTypes = new Set([
                  'sync_declaration', 'sync_pair_block', 'conflict_resolution_block', 'replica_block',
                ]);
                const leafTypes = new Set([
                  'identifier', 'string_literal', 'comment', 'annotation',
                ]);

                for (const nodeType of SYNC_NODE_TYPES) {
                  await storage.put('node_types', `${instanceId}:${nodeType}`, {
                    grammar: instanceId,
                    nodeType,
                    language: 'sync-spec',
                    category: structuralTypes.has(nodeType)
                      ? 'structural'
                      : leafTypes.has(nodeType)
                        ? 'leaf'
                        : 'semantic',
                  });
                }

                return initializeOk(instanceId);
              },
              toStorageError,
            ),
          ),
        (errorMsg) => TE.right(initializeLoadError(errorMsg)),
      ),
    ),
};
