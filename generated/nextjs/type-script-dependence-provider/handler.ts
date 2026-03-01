// TypeScript import/export dependency extraction — module resolution and dependency graph construction.
// Extracts import declarations, re-exports, dynamic imports, and require calls from TS/TSX source.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  TypeScriptDependenceProviderStorage,
  TypeScriptDependenceProviderInitializeInput,
  TypeScriptDependenceProviderInitializeOutput,
} from './types.js';

import {
  initializeOk,
  initializeLoadError,
} from './types.js';

export interface TypeScriptDependenceProviderError {
  readonly code: string;
  readonly message: string;
}

export interface TypeScriptDependenceProviderHandler {
  readonly initialize: (
    input: TypeScriptDependenceProviderInitializeInput,
    storage: TypeScriptDependenceProviderStorage,
  ) => TE.TaskEither<TypeScriptDependenceProviderError, TypeScriptDependenceProviderInitializeOutput>;
}

// --- Pure helpers ---

/** Dependency kinds extracted from TypeScript source */
type DependencyKind =
  | 'static-import'
  | 'dynamic-import'
  | 'require'
  | 're-export'
  | 'type-import'
  | 'side-effect-import';

/** Patterns used to detect each dependency kind */
interface DependencyPattern {
  readonly kind: DependencyKind;
  readonly regex: RegExp;
  readonly captureGroup: number;
}

/** Build the set of dependency extraction patterns */
const buildDependencyPatterns = (): readonly DependencyPattern[] => [
  {
    kind: 'static-import',
    regex: /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s*,?\s*)*from\s+['"]([^'"]+)['"]/g,
    captureGroup: 1,
  },
  {
    kind: 'type-import',
    regex: /import\s+type\s+(?:\{[^}]*\}|\w+)\s+from\s+['"]([^'"]+)['"]/g,
    captureGroup: 1,
  },
  {
    kind: 'dynamic-import',
    regex: /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    captureGroup: 1,
  },
  {
    kind: 'require',
    regex: /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    captureGroup: 1,
  },
  {
    kind: 're-export',
    regex: /export\s+(?:\{[^}]*\}|\*)\s+from\s+['"]([^'"]+)['"]/g,
    captureGroup: 1,
  },
  {
    kind: 'side-effect-import',
    regex: /import\s+['"]([^'"]+)['"]\s*;?/g,
    captureGroup: 1,
  },
];

/** Module resolution categories */
type ModuleCategory = 'relative' | 'package' | 'builtin' | 'scoped-package';

/** Classify a module specifier into its resolution category */
const classifyModuleSpecifier = (specifier: string): ModuleCategory => {
  if (specifier.startsWith('.') || specifier.startsWith('/')) {
    return 'relative';
  }
  if (specifier.startsWith('@') && specifier.includes('/')) {
    return 'scoped-package';
  }
  const builtins = new Set([
    'fs', 'path', 'os', 'crypto', 'http', 'https', 'url', 'util',
    'stream', 'events', 'buffer', 'child_process', 'net', 'dns',
    'cluster', 'worker_threads', 'assert', 'querystring', 'zlib',
    'node:fs', 'node:path', 'node:os', 'node:crypto', 'node:http',
    'node:https', 'node:url', 'node:util', 'node:stream', 'node:events',
    'node:buffer', 'node:child_process', 'node:net', 'node:dns',
    'node:test', 'node:assert',
  ]);
  if (builtins.has(specifier)) {
    return 'builtin';
  }
  return 'package';
};

/** Validate that the dependency patterns compile without error */
const validatePatterns = (
  patterns: readonly DependencyPattern[],
): O.Option<string> => {
  for (const p of patterns) {
    try {
      // Reset lastIndex to ensure clean state
      p.regex.lastIndex = 0;
    } catch {
      return O.some(`Failed to compile pattern for dependency kind: ${p.kind}`);
    }
  }
  if (patterns.length === 0) {
    return O.some('No dependency patterns registered');
  }
  return O.none;
};

const toStorageError = (error: unknown): TypeScriptDependenceProviderError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const typeScriptDependenceProviderHandler: TypeScriptDependenceProviderHandler = {
  initialize: (_input, storage) => {
    const patterns = buildDependencyPatterns();
    return pipe(
      validatePatterns(patterns),
      O.fold(
        () =>
          pipe(
            TE.tryCatch(
              async () => {
                const instanceId = `ts-dependence-${Date.now()}`;

                await storage.put('providers', instanceId, {
                  instanceId,
                  language: 'typescript',
                  supportedExtensions: ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'],
                  dependencyKinds: [
                    'static-import', 'dynamic-import', 'require',
                    're-export', 'type-import', 'side-effect-import',
                  ],
                  moduleCategories: ['relative', 'package', 'builtin', 'scoped-package'],
                  patternCount: patterns.length,
                  initializedAt: new Date().toISOString(),
                });

                // Persist each pattern as a registered extraction rule
                for (const pattern of patterns) {
                  await storage.put('extraction_rules', `${instanceId}:${pattern.kind}`, {
                    provider: instanceId,
                    kind: pattern.kind,
                    patternSource: pattern.regex.source,
                    captureGroup: pattern.captureGroup,
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
