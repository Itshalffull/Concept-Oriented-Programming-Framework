// TypeScript symbol extraction — classes, functions, interfaces, types, enums, and variables.
// Builds a symbol table from TS/TSX source with export visibility and type signature metadata.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  TypeScriptSymbolExtractorStorage,
  TypeScriptSymbolExtractorInitializeInput,
  TypeScriptSymbolExtractorInitializeOutput,
} from './types.js';

import {
  initializeOk,
  initializeLoadError,
} from './types.js';

export interface TypeScriptSymbolExtractorError {
  readonly code: string;
  readonly message: string;
}

export interface TypeScriptSymbolExtractorHandler {
  readonly initialize: (
    input: TypeScriptSymbolExtractorInitializeInput,
    storage: TypeScriptSymbolExtractorStorage,
  ) => TE.TaskEither<TypeScriptSymbolExtractorError, TypeScriptSymbolExtractorInitializeOutput>;
}

// --- Pure helpers ---

/** Symbol kinds extractable from TypeScript */
type SymbolKind =
  | 'class'
  | 'function'
  | 'interface'
  | 'type-alias'
  | 'enum'
  | 'variable'
  | 'constant'
  | 'namespace'
  | 'method'
  | 'property'
  | 'parameter'
  | 'type-parameter'
  | 'enum-member'
  | 'decorator'
  | 'module';

/** Extraction rule for a symbol kind: which AST node type to match */
interface ExtractionRule {
  readonly symbolKind: SymbolKind;
  readonly nodeType: string;
  readonly nameField: string;
  readonly canExport: boolean;
  readonly canBeDefault: boolean;
  readonly hasTypeSignature: boolean;
}

/** Build the set of extraction rules for TypeScript symbols */
const buildExtractionRules = (): readonly ExtractionRule[] => [
  { symbolKind: 'class', nodeType: 'class_declaration', nameField: 'name', canExport: true, canBeDefault: true, hasTypeSignature: false },
  { symbolKind: 'function', nodeType: 'function_declaration', nameField: 'name', canExport: true, canBeDefault: true, hasTypeSignature: true },
  { symbolKind: 'interface', nodeType: 'interface_declaration', nameField: 'name', canExport: true, canBeDefault: false, hasTypeSignature: false },
  { symbolKind: 'type-alias', nodeType: 'type_alias_declaration', nameField: 'name', canExport: true, canBeDefault: false, hasTypeSignature: false },
  { symbolKind: 'enum', nodeType: 'enum_declaration', nameField: 'name', canExport: true, canBeDefault: false, hasTypeSignature: false },
  { symbolKind: 'variable', nodeType: 'variable_declarator', nameField: 'name', canExport: true, canBeDefault: false, hasTypeSignature: true },
  { symbolKind: 'constant', nodeType: 'variable_declarator', nameField: 'name', canExport: true, canBeDefault: false, hasTypeSignature: true },
  { symbolKind: 'namespace', nodeType: 'namespace_declaration', nameField: 'name', canExport: true, canBeDefault: false, hasTypeSignature: false },
  { symbolKind: 'method', nodeType: 'method_definition', nameField: 'name', canExport: false, canBeDefault: false, hasTypeSignature: true },
  { symbolKind: 'property', nodeType: 'public_field_definition', nameField: 'name', canExport: false, canBeDefault: false, hasTypeSignature: true },
  { symbolKind: 'parameter', nodeType: 'required_parameter', nameField: 'pattern', canExport: false, canBeDefault: false, hasTypeSignature: true },
  { symbolKind: 'type-parameter', nodeType: 'type_parameter', nameField: 'name', canExport: false, canBeDefault: false, hasTypeSignature: false },
  { symbolKind: 'enum-member', nodeType: 'enum_assignment', nameField: 'name', canExport: false, canBeDefault: false, hasTypeSignature: false },
  { symbolKind: 'decorator', nodeType: 'decorator', nameField: 'value', canExport: false, canBeDefault: false, hasTypeSignature: false },
  { symbolKind: 'module', nodeType: 'module_declaration', nameField: 'name', canExport: true, canBeDefault: false, hasTypeSignature: false },
];

/** Export visibility levels */
type ExportVisibility = 'none' | 'named' | 'default' | 're-export';

/** Validate that all primary symbol kinds have extraction rules */
const validateRuleCoverage = (
  rules: readonly ExtractionRule[],
): O.Option<string> => {
  const primary: readonly SymbolKind[] = ['class', 'function', 'interface', 'type-alias', 'enum', 'variable'];
  const covered = new Set(rules.map((r) => r.symbolKind));
  const missing = primary.filter((p) => !covered.has(p));
  return missing.length > 0
    ? O.some(`Missing extraction rules for primary symbol kinds: ${missing.join(', ')}`)
    : O.none;
};

const toStorageError = (error: unknown): TypeScriptSymbolExtractorError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const typeScriptSymbolExtractorHandler: TypeScriptSymbolExtractorHandler = {
  initialize: (_input, storage) => {
    const rules = buildExtractionRules();
    return pipe(
      validateRuleCoverage(rules),
      O.fold(
        () =>
          pipe(
            TE.tryCatch(
              async () => {
                const instanceId = `ts-symbol-extractor-${Date.now()}`;

                await storage.put('extractors', instanceId, {
                  instanceId,
                  language: 'typescript',
                  supportedExtensions: ['.ts', '.tsx', '.mts', '.cts'],
                  symbolKinds: [...new Set(rules.map((r) => r.symbolKind))],
                  ruleCount: rules.length,
                  exportVisibilities: ['none', 'named', 'default', 're-export'],
                  initializedAt: new Date().toISOString(),
                });

                // Persist each extraction rule for symbol-kind-based lookup
                for (const rule of rules) {
                  await storage.put('extraction_rules', `${instanceId}:${rule.symbolKind}`, {
                    extractor: instanceId,
                    symbolKind: rule.symbolKind,
                    nodeType: rule.nodeType,
                    nameField: rule.nameField,
                    canExport: rule.canExport,
                    canBeDefault: rule.canBeDefault,
                    hasTypeSignature: rule.hasTypeSignature,
                  });
                }

                return initializeOk(instanceId);
              },
              toStorageError,
            ),
          ),
        (errorMsg) => TE.right(initializeLoadError(errorMsg)),
      ),
    );
  },
};
