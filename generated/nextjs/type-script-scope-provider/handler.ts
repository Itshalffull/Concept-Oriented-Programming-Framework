// TypeScript scoping — block, function, and module scope resolution with name binding.
// Tracks scope nesting, variable declarations, and name visibility across scope boundaries.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  TypeScriptScopeProviderStorage,
  TypeScriptScopeProviderInitializeInput,
  TypeScriptScopeProviderInitializeOutput,
} from './types.js';

import {
  initializeOk,
  initializeLoadError,
} from './types.js';

export interface TypeScriptScopeProviderError {
  readonly code: string;
  readonly message: string;
}

export interface TypeScriptScopeProviderHandler {
  readonly initialize: (
    input: TypeScriptScopeProviderInitializeInput,
    storage: TypeScriptScopeProviderStorage,
  ) => TE.TaskEither<TypeScriptScopeProviderError, TypeScriptScopeProviderInitializeOutput>;
}

// --- Pure helpers ---

/** Scope kinds in TypeScript */
type ScopeKind =
  | 'module'
  | 'function'
  | 'block'
  | 'class'
  | 'for'
  | 'catch'
  | 'switch'
  | 'namespace'
  | 'type-parameter';

/** Declaration kinds that introduce names into a scope */
type DeclarationKind =
  | 'var'
  | 'let'
  | 'const'
  | 'function'
  | 'class'
  | 'interface'
  | 'type'
  | 'enum'
  | 'parameter'
  | 'import'
  | 'namespace';

/** Binding behavior for each declaration kind */
interface BindingRule {
  readonly declarationKind: DeclarationKind;
  readonly hoisted: boolean;
  readonly blockScoped: boolean;
  readonly canRedeclare: boolean;
  readonly isTypeOnly: boolean;
}

/** Build the binding rules for each declaration kind */
const buildBindingRules = (): readonly BindingRule[] => [
  { declarationKind: 'var', hoisted: true, blockScoped: false, canRedeclare: true, isTypeOnly: false },
  { declarationKind: 'let', hoisted: false, blockScoped: true, canRedeclare: false, isTypeOnly: false },
  { declarationKind: 'const', hoisted: false, blockScoped: true, canRedeclare: false, isTypeOnly: false },
  { declarationKind: 'function', hoisted: true, blockScoped: false, canRedeclare: true, isTypeOnly: false },
  { declarationKind: 'class', hoisted: false, blockScoped: true, canRedeclare: false, isTypeOnly: false },
  { declarationKind: 'interface', hoisted: true, blockScoped: false, canRedeclare: true, isTypeOnly: true },
  { declarationKind: 'type', hoisted: true, blockScoped: false, canRedeclare: false, isTypeOnly: true },
  { declarationKind: 'enum', hoisted: false, blockScoped: true, canRedeclare: false, isTypeOnly: false },
  { declarationKind: 'parameter', hoisted: false, blockScoped: true, canRedeclare: false, isTypeOnly: false },
  { declarationKind: 'import', hoisted: true, blockScoped: false, canRedeclare: false, isTypeOnly: false },
  { declarationKind: 'namespace', hoisted: true, blockScoped: false, canRedeclare: true, isTypeOnly: false },
];

/** Scope-creating AST node types */
const SCOPE_CREATORS: ReadonlyMap<string, ScopeKind> = new Map([
  ['program', 'module'],
  ['function_declaration', 'function'],
  ['arrow_function', 'function'],
  ['function_expression', 'function'],
  ['method_definition', 'function'],
  ['class_declaration', 'class'],
  ['class_expression', 'class'],
  ['statement_block', 'block'],
  ['for_statement', 'for'],
  ['for_in_statement', 'for'],
  ['for_of_statement', 'for'],
  ['catch_clause', 'catch'],
  ['switch_statement', 'switch'],
  ['namespace_declaration', 'namespace'],
  ['type_parameters', 'type-parameter'],
]);

/** Validate that binding rules cover all required declaration kinds */
const validateBindingRules = (
  rules: readonly BindingRule[],
): O.Option<string> => {
  const required: readonly DeclarationKind[] = ['var', 'let', 'const', 'function', 'class', 'import'];
  const covered = new Set(rules.map((r) => r.declarationKind));
  const missing = required.filter((r) => !covered.has(r));
  return missing.length > 0
    ? O.some(`Missing binding rules for declaration kinds: ${missing.join(', ')}`)
    : O.none;
};

const toStorageError = (error: unknown): TypeScriptScopeProviderError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const typeScriptScopeProviderHandler: TypeScriptScopeProviderHandler = {
  initialize: (_input, storage) => {
    const bindingRules = buildBindingRules();
    return pipe(
      validateBindingRules(bindingRules),
      O.fold(
        () =>
          pipe(
            TE.tryCatch(
              async () => {
                const instanceId = `ts-scope-${Date.now()}`;

                await storage.put('providers', instanceId, {
                  instanceId,
                  language: 'typescript',
                  scopeKinds: [
                    'module', 'function', 'block', 'class', 'for',
                    'catch', 'switch', 'namespace', 'type-parameter',
                  ],
                  declarationKinds: bindingRules.map((r) => r.declarationKind),
                  scopeCreatorCount: SCOPE_CREATORS.size,
                  bindingRuleCount: bindingRules.length,
                  initializedAt: new Date().toISOString(),
                });

                // Persist binding rules for runtime lookup
                for (const rule of bindingRules) {
                  await storage.put('binding_rules', `${instanceId}:${rule.declarationKind}`, {
                    provider: instanceId,
                    declarationKind: rule.declarationKind,
                    hoisted: rule.hoisted,
                    blockScoped: rule.blockScoped,
                    canRedeclare: rule.canRedeclare,
                    isTypeOnly: rule.isTypeOnly,
                  });
                }

                // Persist scope creator mappings
                for (const [nodeType, scopeKind] of SCOPE_CREATORS) {
                  await storage.put('scope_creators', `${instanceId}:${nodeType}`, {
                    provider: instanceId,
                    nodeType,
                    scopeKind,
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
