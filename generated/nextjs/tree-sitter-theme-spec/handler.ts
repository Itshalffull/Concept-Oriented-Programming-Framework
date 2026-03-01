// Tree-sitter grammar for theme spec files — design token and theming DSL parsing.
// Registers node types for palette, typography, elevation, and design token declarations.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  TreeSitterThemeSpecStorage,
  TreeSitterThemeSpecInitializeInput,
  TreeSitterThemeSpecInitializeOutput,
} from './types.js';

import {
  initializeOk,
  initializeLoadError,
} from './types.js';

export interface TreeSitterThemeSpecError {
  readonly code: string;
  readonly message: string;
}

export interface TreeSitterThemeSpecHandler {
  readonly initialize: (
    input: TreeSitterThemeSpecInitializeInput,
    storage: TreeSitterThemeSpecStorage,
  ) => TE.TaskEither<TreeSitterThemeSpecError, TreeSitterThemeSpecInitializeOutput>;
}

// --- Pure helpers ---

/** Node types recognized in theme spec grammar */
const THEME_NODE_TYPES: readonly string[] = [
  'source_file',
  'theme_declaration',
  'theme_name',
  'extends_clause',
  'palette_block',
  'color_declaration',
  'color_value',
  'color_reference',
  'typography_block',
  'font_family_declaration',
  'font_size_declaration',
  'font_weight_declaration',
  'line_height_declaration',
  'elevation_block',
  'shadow_declaration',
  'shadow_value',
  'spacing_block',
  'spacing_declaration',
  'design_token_block',
  'token_declaration',
  'token_name',
  'token_value',
  'token_reference',
  'breakpoint_block',
  'breakpoint_declaration',
  'display_mode_block',
  'mode_declaration',
  'annotation',
  'comment',
  'identifier',
  'string_literal',
  'number_literal',
  'hex_color',
] as const;

/** Theme domain categories for node type classification */
const THEME_CATEGORIES: ReadonlyMap<string, string> = new Map([
  ['palette_block', 'color'],
  ['color_declaration', 'color'],
  ['color_value', 'color'],
  ['color_reference', 'color'],
  ['hex_color', 'color'],
  ['typography_block', 'typography'],
  ['font_family_declaration', 'typography'],
  ['font_size_declaration', 'typography'],
  ['font_weight_declaration', 'typography'],
  ['line_height_declaration', 'typography'],
  ['elevation_block', 'elevation'],
  ['shadow_declaration', 'elevation'],
  ['shadow_value', 'elevation'],
  ['spacing_block', 'spacing'],
  ['spacing_declaration', 'spacing'],
  ['design_token_block', 'token'],
  ['token_declaration', 'token'],
  ['token_name', 'token'],
  ['token_value', 'token'],
  ['token_reference', 'token'],
  ['breakpoint_block', 'responsive'],
  ['breakpoint_declaration', 'responsive'],
  ['display_mode_block', 'mode'],
  ['mode_declaration', 'mode'],
]);

/** Validate required theme blocks are present */
const validateThemeCompleteness = (
  nodeTypes: readonly string[],
): O.Option<string> => {
  const required = ['palette_block', 'typography_block', 'design_token_block'];
  const nodeSet = new Set(nodeTypes);
  const missing = required.filter((r) => !nodeSet.has(r));
  return missing.length > 0
    ? O.some(`Missing required theme blocks: ${missing.join(', ')}`)
    : O.none;
};

const toStorageError = (error: unknown): TreeSitterThemeSpecError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const treeSitterThemeSpecHandler: TreeSitterThemeSpecHandler = {
  initialize: (_input, storage) =>
    pipe(
      validateThemeCompleteness(THEME_NODE_TYPES),
      O.fold(
        () =>
          pipe(
            TE.tryCatch(
              async () => {
                const instanceId = `theme-spec-grammar-${Date.now()}`;

                await storage.put('grammars', instanceId, {
                  instanceId,
                  language: 'theme-spec',
                  version: '1.0.0',
                  fileExtensions: ['.theme'],
                  rootNode: 'source_file',
                  nodeTypeCount: THEME_NODE_TYPES.length,
                  supportsInheritance: true,
                  supportsDesignTokens: true,
                  categories: ['color', 'typography', 'elevation', 'spacing', 'token', 'responsive', 'mode'],
                  initializedAt: new Date().toISOString(),
                });

                for (const nodeType of THEME_NODE_TYPES) {
                  await storage.put('node_types', `${instanceId}:${nodeType}`, {
                    grammar: instanceId,
                    nodeType,
                    language: 'theme-spec',
                    category: THEME_CATEGORIES.get(nodeType) ?? 'structural',
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
