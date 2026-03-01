// Tree-sitter grammar for widget spec files — CST parsing for widget definitions.
// Registers node types for widget props, slots, state bindings, event handlers, and layout.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  TreeSitterWidgetSpecStorage,
  TreeSitterWidgetSpecInitializeInput,
  TreeSitterWidgetSpecInitializeOutput,
} from './types.js';

import {
  initializeOk,
  initializeLoadError,
} from './types.js';

export interface TreeSitterWidgetSpecError {
  readonly code: string;
  readonly message: string;
}

export interface TreeSitterWidgetSpecHandler {
  readonly initialize: (
    input: TreeSitterWidgetSpecInitializeInput,
    storage: TreeSitterWidgetSpecStorage,
  ) => TE.TaskEither<TreeSitterWidgetSpecError, TreeSitterWidgetSpecInitializeOutput>;
}

// --- Pure helpers ---

/** Node types recognized in widget spec grammar */
const WIDGET_NODE_TYPES: readonly string[] = [
  'source_file',
  'widget_declaration',
  'widget_name',
  'extends_clause',
  'props_block',
  'prop_declaration',
  'prop_name',
  'prop_type',
  'prop_default',
  'prop_required',
  'slots_block',
  'slot_declaration',
  'slot_name',
  'slot_fallback',
  'state_block',
  'state_declaration',
  'state_name',
  'state_type',
  'state_initial',
  'events_block',
  'event_declaration',
  'event_name',
  'event_payload_type',
  'render_block',
  'element_expression',
  'component_reference',
  'binding_expression',
  'conditional_render',
  'list_render',
  'style_block',
  'style_declaration',
  'annotation',
  'comment',
  'identifier',
  'string_literal',
  'type_expression',
] as const;

/** Structural blocks that must be present for a valid widget grammar */
const REQUIRED_BLOCKS: readonly string[] = [
  'widget_declaration', 'props_block', 'slots_block', 'state_block',
  'events_block', 'render_block',
] as const;

/** Categorize widget spec nodes by their domain role */
const WIDGET_CATEGORIES: ReadonlyMap<string, string> = new Map([
  ['props_block', 'props'],
  ['prop_declaration', 'props'],
  ['prop_name', 'props'],
  ['prop_type', 'props'],
  ['prop_default', 'props'],
  ['prop_required', 'props'],
  ['slots_block', 'slots'],
  ['slot_declaration', 'slots'],
  ['slot_name', 'slots'],
  ['slot_fallback', 'slots'],
  ['state_block', 'state'],
  ['state_declaration', 'state'],
  ['state_name', 'state'],
  ['state_type', 'state'],
  ['state_initial', 'state'],
  ['events_block', 'events'],
  ['event_declaration', 'events'],
  ['event_name', 'events'],
  ['event_payload_type', 'events'],
  ['render_block', 'render'],
  ['element_expression', 'render'],
  ['component_reference', 'render'],
  ['binding_expression', 'render'],
  ['conditional_render', 'render'],
  ['list_render', 'render'],
  ['style_block', 'style'],
  ['style_declaration', 'style'],
]);

/** Validate that required widget blocks are present in node types */
const validateWidgetCompleteness = (
  nodeTypes: readonly string[],
): O.Option<string> => {
  const nodeSet = new Set(nodeTypes);
  const missing = REQUIRED_BLOCKS.filter((r) => !nodeSet.has(r));
  return missing.length > 0
    ? O.some(`Missing required widget spec blocks: ${missing.join(', ')}`)
    : O.none;
};

const toStorageError = (error: unknown): TreeSitterWidgetSpecError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const treeSitterWidgetSpecHandler: TreeSitterWidgetSpecHandler = {
  initialize: (_input, storage) =>
    pipe(
      validateWidgetCompleteness(WIDGET_NODE_TYPES),
      O.fold(
        () =>
          pipe(
            TE.tryCatch(
              async () => {
                const instanceId = `widget-spec-grammar-${Date.now()}`;

                await storage.put('grammars', instanceId, {
                  instanceId,
                  language: 'widget-spec',
                  version: '1.0.0',
                  fileExtensions: ['.widget'],
                  rootNode: 'source_file',
                  nodeTypeCount: WIDGET_NODE_TYPES.length,
                  supportsInheritance: true,
                  supportsSlots: true,
                  supportsConditionalRender: true,
                  categories: ['props', 'slots', 'state', 'events', 'render', 'style'],
                  initializedAt: new Date().toISOString(),
                });

                for (const nodeType of WIDGET_NODE_TYPES) {
                  await storage.put('node_types', `${instanceId}:${nodeType}`, {
                    grammar: instanceId,
                    nodeType,
                    language: 'widget-spec',
                    category: WIDGET_CATEGORIES.get(nodeType) ?? 'structural',
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
