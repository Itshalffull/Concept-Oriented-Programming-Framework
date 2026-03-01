// Cross-language dependency extraction via tree-sitter — unified import/include pattern matching.
// Registers language-specific dependency patterns for TypeScript, Rust, Python, Go, and more.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  UniversalTreeSitterDependenceProviderStorage,
  UniversalTreeSitterDependenceProviderInitializeInput,
  UniversalTreeSitterDependenceProviderInitializeOutput,
} from './types.js';

import {
  initializeOk,
  initializeLoadError,
} from './types.js';

export interface UniversalTreeSitterDependenceProviderError {
  readonly code: string;
  readonly message: string;
}

export interface UniversalTreeSitterDependenceProviderHandler {
  readonly initialize: (
    input: UniversalTreeSitterDependenceProviderInitializeInput,
    storage: UniversalTreeSitterDependenceProviderStorage,
  ) => TE.TaskEither<UniversalTreeSitterDependenceProviderError, UniversalTreeSitterDependenceProviderInitializeOutput>;
}

// --- Pure helpers ---

/** Language-specific dependency extraction configuration */
interface LanguageDependencyConfig {
  readonly language: string;
  readonly extensions: readonly string[];
  readonly importNodeTypes: readonly string[];
  readonly queryPattern: string;
  readonly moduleSpecifierField: string;
}

/** Build the dependency configs for all supported languages */
const buildLanguageConfigs = (): readonly LanguageDependencyConfig[] => [
  {
    language: 'typescript',
    extensions: ['.ts', '.tsx', '.mts', '.cts'],
    importNodeTypes: ['import_declaration', 'export_declaration', 'call_expression'],
    queryPattern: '(import_declaration source: (string) @specifier)',
    moduleSpecifierField: 'source',
  },
  {
    language: 'javascript',
    extensions: ['.js', '.jsx', '.mjs', '.cjs'],
    importNodeTypes: ['import_declaration', 'export_declaration', 'call_expression'],
    queryPattern: '(import_declaration source: (string) @specifier)',
    moduleSpecifierField: 'source',
  },
  {
    language: 'rust',
    extensions: ['.rs'],
    importNodeTypes: ['use_declaration', 'extern_crate_declaration'],
    queryPattern: '(use_declaration path: (scoped_identifier) @path)',
    moduleSpecifierField: 'path',
  },
  {
    language: 'python',
    extensions: ['.py', '.pyi'],
    importNodeTypes: ['import_statement', 'import_from_statement'],
    queryPattern: '(import_from_statement module_name: (dotted_name) @module)',
    moduleSpecifierField: 'module_name',
  },
  {
    language: 'go',
    extensions: ['.go'],
    importNodeTypes: ['import_declaration', 'import_spec'],
    queryPattern: '(import_spec path: (interpreted_string_literal) @path)',
    moduleSpecifierField: 'path',
  },
  {
    language: 'swift',
    extensions: ['.swift'],
    importNodeTypes: ['import_declaration'],
    queryPattern: '(import_declaration (identifier) @module)',
    moduleSpecifierField: 'identifier',
  },
  {
    language: 'solidity',
    extensions: ['.sol'],
    importNodeTypes: ['import_directive'],
    queryPattern: '(import_directive source: (string) @source)',
    moduleSpecifierField: 'source',
  },
];

/** Validate that each config has at least one import node type and a query pattern */
const validateConfigs = (
  configs: readonly LanguageDependencyConfig[],
): O.Option<string> => {
  const issues: string[] = [];
  for (const config of configs) {
    if (config.importNodeTypes.length === 0) {
      issues.push(`${config.language}: no import node types defined`);
    }
    if (config.queryPattern.trim().length === 0) {
      issues.push(`${config.language}: empty query pattern`);
    }
    if (config.extensions.length === 0) {
      issues.push(`${config.language}: no file extensions defined`);
    }
  }
  return issues.length > 0
    ? O.some(`Language config validation errors: ${issues.join('; ')}`)
    : O.none;
};

const toStorageError = (error: unknown): UniversalTreeSitterDependenceProviderError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const universalTreeSitterDependenceProviderHandler: UniversalTreeSitterDependenceProviderHandler = {
  initialize: (_input, storage) => {
    const configs = buildLanguageConfigs();
    return pipe(
      validateConfigs(configs),
      O.fold(
        () =>
          pipe(
            TE.tryCatch(
              async () => {
                const instanceId = `universal-dep-provider-${Date.now()}`;

                // Build extension-to-language lookup
                const extensionMap: Record<string, string> = {};
                for (const config of configs) {
                  for (const ext of config.extensions) {
                    extensionMap[ext] = config.language;
                  }
                }

                await storage.put('providers', instanceId, {
                  instanceId,
                  supportedLanguages: configs.map((c) => c.language),
                  languageCount: configs.length,
                  extensionMap,
                  initializedAt: new Date().toISOString(),
                });

                // Persist each language configuration
                for (const config of configs) {
                  await storage.put('language_configs', `${instanceId}:${config.language}`, {
                    provider: instanceId,
                    language: config.language,
                    extensions: [...config.extensions],
                    importNodeTypes: [...config.importNodeTypes],
                    queryPattern: config.queryPattern,
                    moduleSpecifierField: config.moduleSpecifierField,
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
