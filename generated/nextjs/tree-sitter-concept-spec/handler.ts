// Tree-sitter grammar for .concept spec files — CST parsing with node type registry.
// Parses concept definitions, operations, variants, and annotations into concrete syntax trees.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import * as A from 'fp-ts/Array';
import { pipe } from 'fp-ts/function';

import type {
  TreeSitterConceptSpecStorage,
  TreeSitterConceptSpecInitializeInput,
  TreeSitterConceptSpecInitializeOutput,
} from './types.js';

import {
  initializeOk,
  initializeLoadError,
} from './types.js';

export interface TreeSitterConceptSpecError {
  readonly code: string;
  readonly message: string;
}

export interface TreeSitterConceptSpecHandler {
  readonly initialize: (
    input: TreeSitterConceptSpecInitializeInput,
    storage: TreeSitterConceptSpecStorage,
  ) => TE.TaskEither<TreeSitterConceptSpecError, TreeSitterConceptSpecInitializeOutput>;
}

// --- Pure helpers ---

/** Node types recognized in .concept grammar */
const CONCEPT_NODE_TYPES: readonly string[] = [
  'source_file',
  'concept_declaration',
  'concept_name',
  'operation_block',
  'operation_declaration',
  'operation_name',
  'input_block',
  'output_block',
  'field_declaration',
  'field_name',
  'field_type',
  'variant_block',
  'variant_declaration',
  'variant_name',
  'annotation',
  'annotation_name',
  'annotation_value',
  'comment',
  'string_literal',
  'identifier',
] as const;

/** Grammar metadata for concept spec language */
const buildGrammarMetadata = (): Record<string, unknown> => ({
  language: 'concept-spec',
  version: '1.0.0',
  fileExtensions: ['.concept'],
  nodeTypes: CONCEPT_NODE_TYPES,
  rootNode: 'source_file',
  supportsAnnotations: true,
  supportsVariants: true,
});

/** Validate that grammar node registry is internally consistent */
const validateNodeTypeRegistry = (
  nodeTypes: readonly string[],
): readonly string[] => {
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const nt of nodeTypes) {
    if (seen.has(nt)) {
      duplicates.push(nt);
    }
    seen.add(nt);
  }
  return duplicates;
};

const toStorageError = (error: unknown): TreeSitterConceptSpecError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const treeSitterConceptSpecHandler: TreeSitterConceptSpecHandler = {
  initialize: (_input, storage) =>
    pipe(
      TE.of(validateNodeTypeRegistry(CONCEPT_NODE_TYPES)),
      TE.chain((duplicates) =>
        duplicates.length > 0
          ? TE.right(
              initializeLoadError(
                `Duplicate node types in concept-spec grammar: ${duplicates.join(', ')}`,
              ),
            )
          : pipe(
              TE.tryCatch(
                async () => {
                  const instanceId = `concept-spec-grammar-${Date.now()}`;
                  const metadata = buildGrammarMetadata();

                  // Persist the grammar instance with its node type registry
                  await storage.put('grammars', instanceId, {
                    instanceId,
                    ...metadata,
                    nodeTypeCount: CONCEPT_NODE_TYPES.length,
                    initializedAt: new Date().toISOString(),
                  });

                  // Persist each node type for lookup
                  for (const nodeType of CONCEPT_NODE_TYPES) {
                    await storage.put('node_types', `${instanceId}:${nodeType}`, {
                      grammar: instanceId,
                      nodeType,
                      language: 'concept-spec',
                    });
                  }

                  return initializeOk(instanceId);
                },
                toStorageError,
              ),
            ),
      ),
    ),
};
