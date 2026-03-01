// Cross-language structure extraction via tree-sitter — unified code structure analysis.
// Extracts functions, classes, methods, and structural landmarks from any tree-sitter-supported language.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  UniversalTreeSitterExtractorStorage,
  UniversalTreeSitterExtractorInitializeInput,
  UniversalTreeSitterExtractorInitializeOutput,
} from './types.js';

import {
  initializeOk,
  initializeLoadError,
} from './types.js';

export interface UniversalTreeSitterExtractorError {
  readonly code: string;
  readonly message: string;
}

export interface UniversalTreeSitterExtractorHandler {
  readonly initialize: (
    input: UniversalTreeSitterExtractorInitializeInput,
    storage: UniversalTreeSitterExtractorStorage,
  ) => TE.TaskEither<UniversalTreeSitterExtractorError, UniversalTreeSitterExtractorInitializeOutput>;
}

// --- Pure helpers ---

/** Structural element kinds extractable across languages */
type StructuralKind =
  | 'function'
  | 'method'
  | 'class'
  | 'interface'
  | 'struct'
  | 'enum'
  | 'trait'
  | 'protocol'
  | 'module'
  | 'namespace'
  | 'type-alias'
  | 'constant'
  | 'variable';

/** Language-specific extraction configuration */
interface LanguageExtractionConfig {
  readonly language: string;
  readonly extensions: readonly string[];
  readonly structuralMappings: ReadonlyMap<string, StructuralKind>;
  readonly nameField: string;
}

/** Build extraction configs for all supported languages */
const buildExtractionConfigs = (): readonly LanguageExtractionConfig[] => [
  {
    language: 'typescript',
    extensions: ['.ts', '.tsx'],
    structuralMappings: new Map<string, StructuralKind>([
      ['function_declaration', 'function'],
      ['arrow_function', 'function'],
      ['method_definition', 'method'],
      ['class_declaration', 'class'],
      ['interface_declaration', 'interface'],
      ['enum_declaration', 'enum'],
      ['namespace_declaration', 'namespace'],
      ['type_alias_declaration', 'type-alias'],
    ]),
    nameField: 'name',
  },
  {
    language: 'rust',
    extensions: ['.rs'],
    structuralMappings: new Map<string, StructuralKind>([
      ['function_item', 'function'],
      ['impl_item', 'method'],
      ['struct_item', 'struct'],
      ['enum_item', 'enum'],
      ['trait_item', 'trait'],
      ['mod_item', 'module'],
      ['type_item', 'type-alias'],
      ['const_item', 'constant'],
      ['static_item', 'variable'],
    ]),
    nameField: 'name',
  },
  {
    language: 'python',
    extensions: ['.py'],
    structuralMappings: new Map<string, StructuralKind>([
      ['function_definition', 'function'],
      ['class_definition', 'class'],
      ['decorated_definition', 'function'],
    ]),
    nameField: 'name',
  },
  {
    language: 'go',
    extensions: ['.go'],
    structuralMappings: new Map<string, StructuralKind>([
      ['function_declaration', 'function'],
      ['method_declaration', 'method'],
      ['type_declaration', 'struct'],
      ['interface_type', 'interface'],
      ['const_declaration', 'constant'],
      ['var_declaration', 'variable'],
    ]),
    nameField: 'name',
  },
  {
    language: 'swift',
    extensions: ['.swift'],
    structuralMappings: new Map<string, StructuralKind>([
      ['function_declaration', 'function'],
      ['class_declaration', 'class'],
      ['struct_declaration', 'struct'],
      ['enum_declaration', 'enum'],
      ['protocol_declaration', 'protocol'],
      ['typealias_declaration', 'type-alias'],
    ]),
    nameField: 'name',
  },
  {
    language: 'solidity',
    extensions: ['.sol'],
    structuralMappings: new Map<string, StructuralKind>([
      ['function_definition', 'function'],
      ['contract_declaration', 'class'],
      ['interface_declaration', 'interface'],
      ['struct_declaration', 'struct'],
      ['enum_declaration', 'enum'],
      ['modifier_definition', 'function'],
      ['event_definition', 'function'],
    ]),
    nameField: 'name',
  },
];

/** Validate that each config has structural mappings */
const validateConfigs = (
  configs: readonly LanguageExtractionConfig[],
): O.Option<string> => {
  const issues: string[] = [];
  for (const config of configs) {
    if (config.structuralMappings.size === 0) {
      issues.push(`${config.language}: no structural mappings defined`);
    }
    if (config.extensions.length === 0) {
      issues.push(`${config.language}: no file extensions defined`);
    }
  }
  return issues.length > 0
    ? O.some(`Extraction config errors: ${issues.join('; ')}`)
    : O.none;
};

const toStorageError = (error: unknown): UniversalTreeSitterExtractorError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const universalTreeSitterExtractorHandler: UniversalTreeSitterExtractorHandler = {
  initialize: (_input, storage) => {
    const configs = buildExtractionConfigs();
    return pipe(
      validateConfigs(configs),
      O.fold(
        () =>
          pipe(
            TE.tryCatch(
              async () => {
                const instanceId = `universal-extractor-${Date.now()}`;

                // Build extension lookup
                const extensionMap: Record<string, string> = {};
                for (const config of configs) {
                  for (const ext of config.extensions) {
                    extensionMap[ext] = config.language;
                  }
                }

                // Collect all structural kinds across languages
                const allKinds = new Set<string>();
                for (const config of configs) {
                  for (const kind of config.structuralMappings.values()) {
                    allKinds.add(kind);
                  }
                }

                await storage.put('extractors', instanceId, {
                  instanceId,
                  supportedLanguages: configs.map((c) => c.language),
                  languageCount: configs.length,
                  structuralKinds: [...allKinds],
                  extensionMap,
                  initializedAt: new Date().toISOString(),
                });

                // Persist each language's structural mappings
                for (const config of configs) {
                  const mappingsObject: Record<string, string> = {};
                  for (const [nodeType, kind] of config.structuralMappings) {
                    mappingsObject[nodeType] = kind;
                  }

                  await storage.put('language_configs', `${instanceId}:${config.language}`, {
                    extractor: instanceId,
                    language: config.language,
                    extensions: [...config.extensions],
                    nameField: config.nameField,
                    mappingCount: config.structuralMappings.size,
                    mappings: mappingsObject,
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
