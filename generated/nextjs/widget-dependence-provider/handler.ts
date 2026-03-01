// Widget spec dependency extraction — components, slots, bindings, and theme token references.
// Analyzes widget specs to build a dependency graph of component references and data bindings.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  WidgetDependenceProviderStorage,
  WidgetDependenceProviderInitializeInput,
  WidgetDependenceProviderInitializeOutput,
} from './types.js';

import {
  initializeOk,
  initializeLoadError,
} from './types.js';

export interface WidgetDependenceProviderError {
  readonly code: string;
  readonly message: string;
}

export interface WidgetDependenceProviderHandler {
  readonly initialize: (
    input: WidgetDependenceProviderInitializeInput,
    storage: WidgetDependenceProviderStorage,
  ) => TE.TaskEither<WidgetDependenceProviderError, WidgetDependenceProviderInitializeOutput>;
}

// --- Pure helpers ---

/** Dependency kinds found in widget specs */
type WidgetDependencyKind =
  | 'component-reference'
  | 'slot-usage'
  | 'data-binding'
  | 'event-binding'
  | 'style-reference'
  | 'theme-token'
  | 'widget-extends'
  | 'concept-reference';

/** Extraction rule for a widget dependency kind */
interface WidgetDependencyRule {
  readonly kind: WidgetDependencyKind;
  readonly sourceNodeType: string;
  readonly targetField: string;
  readonly isRequired: boolean;
  readonly crossesWidgetBoundary: boolean;
}

/** Build dependency extraction rules for widget specs */
const buildDependencyRules = (): readonly WidgetDependencyRule[] => [
  {
    kind: 'component-reference',
    sourceNodeType: 'component_reference',
    targetField: 'name',
    isRequired: true,
    crossesWidgetBoundary: true,
  },
  {
    kind: 'slot-usage',
    sourceNodeType: 'slot_declaration',
    targetField: 'name',
    isRequired: false,
    crossesWidgetBoundary: true,
  },
  {
    kind: 'data-binding',
    sourceNodeType: 'binding_expression',
    targetField: 'path',
    isRequired: true,
    crossesWidgetBoundary: false,
  },
  {
    kind: 'event-binding',
    sourceNodeType: 'event_declaration',
    targetField: 'handler',
    isRequired: false,
    crossesWidgetBoundary: true,
  },
  {
    kind: 'style-reference',
    sourceNodeType: 'style_declaration',
    targetField: 'class',
    isRequired: false,
    crossesWidgetBoundary: false,
  },
  {
    kind: 'theme-token',
    sourceNodeType: 'token_reference',
    targetField: 'token',
    isRequired: true,
    crossesWidgetBoundary: true,
  },
  {
    kind: 'widget-extends',
    sourceNodeType: 'extends_clause',
    targetField: 'base',
    isRequired: true,
    crossesWidgetBoundary: true,
  },
  {
    kind: 'concept-reference',
    sourceNodeType: 'concept_reference',
    targetField: 'uri',
    isRequired: true,
    crossesWidgetBoundary: true,
  },
];

/** Validate that rules cover the critical dependency kinds */
const validateRuleCoverage = (
  rules: readonly WidgetDependencyRule[],
): O.Option<string> => {
  const critical: readonly WidgetDependencyKind[] = [
    'component-reference', 'slot-usage', 'data-binding', 'theme-token',
  ];
  const covered = new Set(rules.map((r) => r.kind));
  const missing = critical.filter((c) => !covered.has(c));
  return missing.length > 0
    ? O.some(`Missing widget dependency rules: ${missing.join(', ')}`)
    : O.none;
};

const toStorageError = (error: unknown): WidgetDependenceProviderError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const widgetDependenceProviderHandler: WidgetDependenceProviderHandler = {
  initialize: (_input, storage) => {
    const rules = buildDependencyRules();
    return pipe(
      validateRuleCoverage(rules),
      O.fold(
        () =>
          pipe(
            TE.tryCatch(
              async () => {
                const instanceId = `widget-dep-provider-${Date.now()}`;

                const crossBoundaryKinds = rules
                  .filter((r) => r.crossesWidgetBoundary)
                  .map((r) => r.kind);

                await storage.put('providers', instanceId, {
                  instanceId,
                  specType: 'widget',
                  dependencyKinds: rules.map((r) => r.kind),
                  ruleCount: rules.length,
                  crossBoundaryKinds,
                  initializedAt: new Date().toISOString(),
                });

                // Persist each extraction rule
                for (const rule of rules) {
                  await storage.put('dependency_rules', `${instanceId}:${rule.kind}`, {
                    provider: instanceId,
                    kind: rule.kind,
                    sourceNodeType: rule.sourceNodeType,
                    targetField: rule.targetField,
                    isRequired: rule.isRequired,
                    crossesWidgetBoundary: rule.crossesWidgetBoundary,
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
