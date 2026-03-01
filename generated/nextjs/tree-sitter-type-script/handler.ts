// Tree-sitter grammar for TypeScript and TSX — full AST node type registry.
// Covers declarations, expressions, statements, types, JSX elements, and decorators.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  TreeSitterTypeScriptStorage,
  TreeSitterTypeScriptInitializeInput,
  TreeSitterTypeScriptInitializeOutput,
} from './types.js';

import {
  initializeOk,
  initializeLoadError,
} from './types.js';

export interface TreeSitterTypeScriptError {
  readonly code: string;
  readonly message: string;
}

export interface TreeSitterTypeScriptHandler {
  readonly initialize: (
    input: TreeSitterTypeScriptInitializeInput,
    storage: TreeSitterTypeScriptStorage,
  ) => TE.TaskEither<TreeSitterTypeScriptError, TreeSitterTypeScriptInitializeOutput>;
}

// --- Pure helpers ---

/** Declaration node types */
const DECLARATION_NODES: readonly string[] = [
  'function_declaration',
  'class_declaration',
  'interface_declaration',
  'type_alias_declaration',
  'enum_declaration',
  'variable_declaration',
  'variable_declarator',
  'import_declaration',
  'export_declaration',
  'namespace_declaration',
  'module_declaration',
  'ambient_declaration',
] as const;

/** Expression node types */
const EXPRESSION_NODES: readonly string[] = [
  'call_expression',
  'member_expression',
  'assignment_expression',
  'binary_expression',
  'unary_expression',
  'ternary_expression',
  'arrow_function',
  'function_expression',
  'template_string',
  'tagged_template_expression',
  'new_expression',
  'await_expression',
  'yield_expression',
  'as_expression',
  'satisfies_expression',
  'non_null_expression',
  'parenthesized_expression',
  'object',
  'array',
  'spread_element',
] as const;

/** Statement node types */
const STATEMENT_NODES: readonly string[] = [
  'program',
  'statement_block',
  'if_statement',
  'for_statement',
  'for_in_statement',
  'for_of_statement',
  'while_statement',
  'do_statement',
  'switch_statement',
  'switch_case',
  'switch_default',
  'return_statement',
  'throw_statement',
  'try_statement',
  'catch_clause',
  'finally_clause',
  'break_statement',
  'continue_statement',
  'expression_statement',
] as const;

/** Type annotation node types */
const TYPE_NODES: readonly string[] = [
  'type_annotation',
  'type_identifier',
  'predefined_type',
  'generic_type',
  'type_arguments',
  'type_parameters',
  'type_parameter',
  'union_type',
  'intersection_type',
  'conditional_type',
  'mapped_type',
  'index_type_query',
  'indexed_access_type',
  'literal_type',
  'tuple_type',
  'readonly_type',
  'template_literal_type',
  'infer_type',
  'function_type',
  'constructor_type',
] as const;

/** JSX node types for TSX support */
const JSX_NODES: readonly string[] = [
  'jsx_element',
  'jsx_opening_element',
  'jsx_closing_element',
  'jsx_self_closing_element',
  'jsx_attribute',
  'jsx_expression',
  'jsx_text',
  'jsx_fragment',
] as const;

/** Leaf/literal node types */
const LEAF_NODES: readonly string[] = [
  'identifier',
  'property_identifier',
  'shorthand_property_identifier',
  'string',
  'number',
  'true',
  'false',
  'null',
  'undefined',
  'this',
  'super',
  'regex',
  'comment',
  'decorator',
] as const;

const ALL_NODE_TYPES: readonly string[] = [
  ...DECLARATION_NODES,
  ...EXPRESSION_NODES,
  ...STATEMENT_NODES,
  ...TYPE_NODES,
  ...JSX_NODES,
  ...LEAF_NODES,
] as const;

/** Categorize a node type by its syntactic role */
const categorizeNodeType = (nodeType: string): string => {
  if ((DECLARATION_NODES as readonly string[]).includes(nodeType)) return 'declaration';
  if ((EXPRESSION_NODES as readonly string[]).includes(nodeType)) return 'expression';
  if ((STATEMENT_NODES as readonly string[]).includes(nodeType)) return 'statement';
  if ((TYPE_NODES as readonly string[]).includes(nodeType)) return 'type';
  if ((JSX_NODES as readonly string[]).includes(nodeType)) return 'jsx';
  return 'leaf';
};

/** Validate that critical declaration types are present */
const validateDeclarationCoverage = (
  nodeTypes: readonly string[],
): O.Option<string> => {
  const critical = [
    'function_declaration', 'class_declaration', 'interface_declaration',
    'type_alias_declaration', 'import_declaration', 'export_declaration',
  ];
  const nodeSet = new Set(nodeTypes);
  const missing = critical.filter((c) => !nodeSet.has(c));
  return missing.length > 0
    ? O.some(`Missing critical TypeScript declaration types: ${missing.join(', ')}`)
    : O.none;
};

const toStorageError = (error: unknown): TreeSitterTypeScriptError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const treeSitterTypeScriptHandler: TreeSitterTypeScriptHandler = {
  initialize: (_input, storage) =>
    pipe(
      validateDeclarationCoverage(ALL_NODE_TYPES),
      O.fold(
        () =>
          pipe(
            TE.tryCatch(
              async () => {
                const instanceId = `typescript-grammar-${Date.now()}`;

                await storage.put('grammars', instanceId, {
                  instanceId,
                  language: 'typescript',
                  version: '5.0.0',
                  fileExtensions: ['.ts', '.tsx', '.mts', '.cts'],
                  rootNode: 'program',
                  nodeTypeCount: ALL_NODE_TYPES.length,
                  supportsJSX: true,
                  supportsDecorators: true,
                  supportsGenerics: true,
                  categories: ['declaration', 'expression', 'statement', 'type', 'jsx', 'leaf'],
                  initializedAt: new Date().toISOString(),
                });

                for (const nodeType of ALL_NODE_TYPES) {
                  await storage.put('node_types', `${instanceId}:${nodeType}`, {
                    grammar: instanceId,
                    nodeType,
                    language: 'typescript',
                    category: categorizeNodeType(nodeType),
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
