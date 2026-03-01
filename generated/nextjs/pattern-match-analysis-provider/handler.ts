// PatternMatchAnalysisProvider — handler.ts
// Pattern matching code analysis provider: initializes a pattern-based static
// analysis engine that detects structural code patterns using configurable
// match rules. Supports AST pattern matching, regex-based token scanning,
// and compositional pattern combinators for code quality and convention checks.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  PatternMatchAnalysisProviderStorage,
  PatternMatchAnalysisProviderInitializeInput,
  PatternMatchAnalysisProviderInitializeOutput,
} from './types.js';

import {
  initializeOk,
  initializeLoadError,
} from './types.js';

export interface PatternMatchAnalysisProviderError {
  readonly code: string;
  readonly message: string;
}

export interface PatternMatchAnalysisProviderHandler {
  readonly initialize: (
    input: PatternMatchAnalysisProviderInitializeInput,
    storage: PatternMatchAnalysisProviderStorage,
  ) => TE.TaskEither<PatternMatchAnalysisProviderError, PatternMatchAnalysisProviderInitializeOutput>;
}

// --- Pattern match engine configuration ---

/** Categories of pattern analysis */
type PatternCategory =
  | 'structural'    // AST structure patterns
  | 'naming'        // naming convention checks
  | 'anti-pattern'  // known anti-pattern detection
  | 'idiom'         // language-idiomatic pattern recognition
  | 'security'      // security-relevant pattern checks
  | 'performance';  // performance-related patterns

/** A pattern rule definition */
interface PatternRule {
  readonly id: string;
  readonly category: PatternCategory;
  readonly description: string;
  readonly severity: 'error' | 'warning' | 'info';
}

/** Built-in pattern rules that ship with the provider */
const BUILTIN_RULES: readonly PatternRule[] = [
  { id: 'no-any', category: 'structural', description: 'Avoid TypeScript `any` type', severity: 'warning' },
  { id: 'no-mutation', category: 'structural', description: 'Detect direct property mutation', severity: 'warning' },
  { id: 'no-throw', category: 'structural', description: 'Detect thrown exceptions (prefer Result types)', severity: 'info' },
  { id: 'naming-camel', category: 'naming', description: 'Enforce camelCase for variables/functions', severity: 'info' },
  { id: 'naming-pascal', category: 'naming', description: 'Enforce PascalCase for types/classes', severity: 'info' },
  { id: 'no-eval', category: 'security', description: 'Detect usage of eval()', severity: 'error' },
  { id: 'no-inner-html', category: 'security', description: 'Detect innerHTML assignment', severity: 'error' },
  { id: 'no-hardcoded-secret', category: 'security', description: 'Detect hardcoded passwords/tokens', severity: 'error' },
  { id: 'prefer-const', category: 'idiom', description: 'Prefer const over let for non-reassigned bindings', severity: 'info' },
  { id: 'prefer-readonly', category: 'idiom', description: 'Prefer readonly for non-mutated fields', severity: 'info' },
  { id: 'no-nested-ternary', category: 'anti-pattern', description: 'Avoid nested ternary expressions', severity: 'warning' },
  { id: 'no-magic-number', category: 'anti-pattern', description: 'Avoid unexplained numeric literals', severity: 'info' },
  { id: 'no-sync-io', category: 'performance', description: 'Detect synchronous I/O in async contexts', severity: 'warning' },
  { id: 'no-unbounded-loop', category: 'performance', description: 'Detect potentially unbounded loops', severity: 'warning' },
];

/** Provider instance prefix */
const PROVIDER_PREFIX = 'pattern-match-analysis';

/** Storage relation name */
const RELATION = 'patternmatchanalysisprovider';

/** Supported analysis target languages */
const SUPPORTED_LANGUAGES: readonly string[] = [
  'typescript', 'javascript', 'python', 'java', 'go', 'rust',
  'c', 'c++', 'c#', 'ruby', 'swift', 'kotlin',
];

const storageError = (error: unknown): PatternMatchAnalysisProviderError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Generate a deterministic instance ID */
const generateInstanceId = (timestamp: number): string =>
  `${PROVIDER_PREFIX}-${timestamp.toString(36)}`;

/** Validate a cached instance record */
const validateCachedInstance = (
  record: Record<string, unknown> | null,
): O.Option<string> =>
  pipe(
    O.fromNullable(record),
    O.chain((r) => {
      const instanceId = r['instanceId'];
      const status = r['status'];
      const ruleCount = r['ruleCount'];
      // Instance is valid if it has the expected rule count and is initialized
      if (
        typeof instanceId === 'string' &&
        status === 'initialized' &&
        typeof ruleCount === 'number' &&
        ruleCount === BUILTIN_RULES.length
      ) {
        return O.some(instanceId);
      }
      return O.none;
    }),
  );

/** Load custom rules from storage (if any have been registered) */
const loadCustomRules = async (
  storage: PatternMatchAnalysisProviderStorage,
): Promise<readonly PatternRule[]> => {
  const customRecords = await storage.find(RELATION, { type: 'custom-rule' });
  return customRecords
    .filter((r) =>
      typeof r['id'] === 'string' &&
      typeof r['category'] === 'string' &&
      typeof r['description'] === 'string',
    )
    .map((r) => ({
      id: r['id'] as string,
      category: r['category'] as PatternCategory,
      description: r['description'] as string,
      severity: (r['severity'] as 'error' | 'warning' | 'info') ?? 'info',
    }));
};

/** Compute category distribution for diagnostics */
const computeCategoryDistribution = (
  rules: readonly PatternRule[],
): Record<string, number> => {
  const distribution: Record<string, number> = {};
  for (const rule of rules) {
    distribution[rule.category] = (distribution[rule.category] ?? 0) + 1;
  }
  return distribution;
};

// --- Implementation ---

export const patternMatchAnalysisProviderHandler: PatternMatchAnalysisProviderHandler = {
  initialize: (_input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          // Check for existing cached provider instance
          const cached = await storage.get(RELATION, 'singleton');

          return pipe(
            validateCachedInstance(cached),
            O.fold(
              // No valid cache: initialize new analysis provider
              async () => {
                const instanceId = generateInstanceId(Date.now());

                // Load any custom rules that were registered
                const customRules = await loadCustomRules(storage);
                const allRules = [...BUILTIN_RULES, ...customRules];

                // Validate that we have at least the built-in rules
                if (BUILTIN_RULES.length === 0) {
                  return initializeLoadError(
                    'Pattern match analysis provider has no built-in rules configured',
                  );
                }

                const distribution = computeCategoryDistribution(allRules);

                // Persist provider instance
                await storage.put(RELATION, 'singleton', {
                  instanceId,
                  status: 'initialized',
                  ruleCount: BUILTIN_RULES.length,
                  totalRules: allRules.length,
                  customRuleCount: customRules.length,
                  categoryDistribution: distribution,
                  supportedLanguages: [...SUPPORTED_LANGUAGES],
                  createdAt: Date.now(),
                });

                // Store individual rule metadata for introspection
                for (const rule of BUILTIN_RULES) {
                  await storage.put(RELATION, `rule:${rule.id}`, {
                    ...rule,
                    type: 'builtin-rule',
                    instanceId,
                  });
                }

                // Store capabilities
                await storage.put(RELATION, `capabilities:${instanceId}`, {
                  totalRules: allRules.length,
                  builtinRules: BUILTIN_RULES.length,
                  customRules: customRules.length,
                  categories: Object.keys(distribution),
                  categoryDistribution: distribution,
                  supportedLanguages: [...SUPPORTED_LANGUAGES],
                  analysisTypes: ['ast-pattern', 'regex-scan', 'combinator'],
                  incremental: true,
                  cacheable: true,
                });

                return initializeOk(instanceId);
              },
              // Valid cache: return existing instance
              async (existingId) => initializeOk(existingId),
            ),
          );
        },
        storageError,
      ),
      TE.chain((resultPromise) =>
        TE.tryCatch(
          () => resultPromise,
          storageError,
        ),
      ),
    ),
};
