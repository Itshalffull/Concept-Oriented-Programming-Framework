// Tree-sitter grammar for YAML — structured document parsing with anchors and aliases.
// Registers node types for mappings, sequences, scalars, tags, and multi-document support.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  TreeSitterYamlStorage,
  TreeSitterYamlInitializeInput,
  TreeSitterYamlInitializeOutput,
} from './types.js';

import {
  initializeOk,
  initializeLoadError,
} from './types.js';

export interface TreeSitterYamlError {
  readonly code: string;
  readonly message: string;
}

export interface TreeSitterYamlHandler {
  readonly initialize: (
    input: TreeSitterYamlInitializeInput,
    storage: TreeSitterYamlStorage,
  ) => TE.TaskEither<TreeSitterYamlError, TreeSitterYamlInitializeOutput>;
}

// --- Pure helpers ---

/** Node types recognized in YAML grammar */
const YAML_NODE_TYPES: readonly string[] = [
  'stream',
  'document',
  'document_start',
  'document_end',
  'directive',
  'tag_directive',
  'yaml_directive',
  'block_mapping',
  'block_mapping_pair',
  'block_sequence',
  'block_sequence_item',
  'flow_mapping',
  'flow_pair',
  'flow_sequence',
  'block_scalar',
  'plain_scalar',
  'double_quote_scalar',
  'single_quote_scalar',
  'integer_scalar',
  'float_scalar',
  'boolean_scalar',
  'null_scalar',
  'anchor',
  'alias',
  'tag',
  'comment',
  'merge_key',
] as const;

/** YAML value node types for type inference */
const SCALAR_TYPES = new Set([
  'plain_scalar', 'double_quote_scalar', 'single_quote_scalar',
  'integer_scalar', 'float_scalar', 'boolean_scalar', 'null_scalar',
  'block_scalar',
]);

/** Collection node types */
const COLLECTION_TYPES = new Set([
  'block_mapping', 'block_sequence', 'flow_mapping', 'flow_sequence',
]);

/** Validate YAML grammar has essential data model nodes */
const validateYamlCompleteness = (
  nodeTypes: readonly string[],
): O.Option<string> => {
  const required = ['document', 'block_mapping', 'block_sequence', 'plain_scalar'];
  const nodeSet = new Set(nodeTypes);
  const missing = required.filter((r) => !nodeSet.has(r));
  return missing.length > 0
    ? O.some(`Missing essential YAML grammar nodes: ${missing.join(', ')}`)
    : O.none;
};

const toStorageError = (error: unknown): TreeSitterYamlError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const treeSitterYamlHandler: TreeSitterYamlHandler = {
  initialize: (_input, storage) =>
    pipe(
      validateYamlCompleteness(YAML_NODE_TYPES),
      O.fold(
        () =>
          pipe(
            TE.tryCatch(
              async () => {
                const instanceId = `yaml-grammar-${Date.now()}`;

                await storage.put('grammars', instanceId, {
                  instanceId,
                  language: 'yaml',
                  version: '1.2.0',
                  fileExtensions: ['.yaml', '.yml'],
                  rootNode: 'stream',
                  nodeTypeCount: YAML_NODE_TYPES.length,
                  supportsMultiDocument: true,
                  supportsAnchors: true,
                  supportsMergeKeys: true,
                  initializedAt: new Date().toISOString(),
                });

                for (const nodeType of YAML_NODE_TYPES) {
                  const category = SCALAR_TYPES.has(nodeType)
                    ? 'scalar'
                    : COLLECTION_TYPES.has(nodeType)
                      ? 'collection'
                      : 'structural';

                  await storage.put('node_types', `${instanceId}:${nodeType}`, {
                    grammar: instanceId,
                    nodeType,
                    language: 'yaml',
                    category,
                    isScalar: SCALAR_TYPES.has(nodeType),
                    isCollection: COLLECTION_TYPES.has(nodeType),
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
