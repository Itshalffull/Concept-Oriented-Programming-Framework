// Widget scoping — props, slots, state, and event name resolution within widget definitions.
// Tracks scope chains for nested widgets and resolves name conflicts across scope boundaries.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  WidgetScopeProviderStorage,
  WidgetScopeProviderInitializeInput,
  WidgetScopeProviderInitializeOutput,
} from './types.js';

import {
  initializeOk,
  initializeLoadError,
} from './types.js';

export interface WidgetScopeProviderError {
  readonly code: string;
  readonly message: string;
}

export interface WidgetScopeProviderHandler {
  readonly initialize: (
    input: WidgetScopeProviderInitializeInput,
    storage: WidgetScopeProviderStorage,
  ) => TE.TaskEither<WidgetScopeProviderError, WidgetScopeProviderInitializeOutput>;
}

// --- Pure helpers ---

/** Scope kinds within widget definitions */
type WidgetScopeKind =
  | 'widget'
  | 'props'
  | 'state'
  | 'slots'
  | 'events'
  | 'render'
  | 'list-item'
  | 'conditional';

/** Name kinds that can be declared in a widget scope */
type WidgetNameKind =
  | 'prop'
  | 'state-field'
  | 'slot'
  | 'event'
  | 'computed'
  | 'list-variable'
  | 'ref';

/** Binding rule for widget name declarations */
interface WidgetBindingRule {
  readonly nameKind: WidgetNameKind;
  readonly owningScope: WidgetScopeKind;
  readonly visibleInChildScopes: boolean;
  readonly canShadow: boolean;
  readonly requiresType: boolean;
}

/** Build the binding rules for widget scopes */
const buildWidgetBindingRules = (): readonly WidgetBindingRule[] => [
  { nameKind: 'prop', owningScope: 'props', visibleInChildScopes: true, canShadow: false, requiresType: true },
  { nameKind: 'state-field', owningScope: 'state', visibleInChildScopes: true, canShadow: false, requiresType: true },
  { nameKind: 'slot', owningScope: 'slots', visibleInChildScopes: true, canShadow: false, requiresType: false },
  { nameKind: 'event', owningScope: 'events', visibleInChildScopes: true, canShadow: false, requiresType: false },
  { nameKind: 'computed', owningScope: 'widget', visibleInChildScopes: true, canShadow: false, requiresType: true },
  { nameKind: 'list-variable', owningScope: 'list-item', visibleInChildScopes: true, canShadow: true, requiresType: false },
  { nameKind: 'ref', owningScope: 'render', visibleInChildScopes: false, canShadow: false, requiresType: false },
];

/** Scope nesting rules: which scope kinds can contain which */
interface ScopeNestingRule {
  readonly parent: WidgetScopeKind;
  readonly allowedChildren: readonly WidgetScopeKind[];
}

/** Build scope nesting rules */
const buildScopeNestingRules = (): readonly ScopeNestingRule[] => [
  { parent: 'widget', allowedChildren: ['props', 'state', 'slots', 'events', 'render'] },
  { parent: 'render', allowedChildren: ['list-item', 'conditional'] },
  { parent: 'list-item', allowedChildren: ['conditional', 'list-item'] },
  { parent: 'conditional', allowedChildren: ['list-item', 'conditional'] },
];

/** Validate that critical scopes have binding rules */
const validateBindingRules = (
  rules: readonly WidgetBindingRule[],
): O.Option<string> => {
  const required: readonly WidgetNameKind[] = ['prop', 'state-field', 'slot', 'event'];
  const covered = new Set(rules.map((r) => r.nameKind));
  const missing = required.filter((r) => !covered.has(r));
  return missing.length > 0
    ? O.some(`Missing widget binding rules: ${missing.join(', ')}`)
    : O.none;
};

const toStorageError = (error: unknown): WidgetScopeProviderError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const widgetScopeProviderHandler: WidgetScopeProviderHandler = {
  initialize: (_input, storage) => {
    const bindingRules = buildWidgetBindingRules();
    const nestingRules = buildScopeNestingRules();

    return pipe(
      validateBindingRules(bindingRules),
      O.fold(
        () =>
          pipe(
            TE.tryCatch(
              async () => {
                const instanceId = `widget-scope-${Date.now()}`;

                await storage.put('providers', instanceId, {
                  instanceId,
                  specType: 'widget',
                  scopeKinds: [
                    'widget', 'props', 'state', 'slots', 'events',
                    'render', 'list-item', 'conditional',
                  ],
                  nameKinds: bindingRules.map((r) => r.nameKind),
                  bindingRuleCount: bindingRules.length,
                  nestingRuleCount: nestingRules.length,
                  initializedAt: new Date().toISOString(),
                });

                // Persist binding rules
                for (const rule of bindingRules) {
                  await storage.put('binding_rules', `${instanceId}:${rule.nameKind}`, {
                    provider: instanceId,
                    nameKind: rule.nameKind,
                    owningScope: rule.owningScope,
                    visibleInChildScopes: rule.visibleInChildScopes,
                    canShadow: rule.canShadow,
                    requiresType: rule.requiresType,
                  });
                }

                // Persist nesting rules
                for (const rule of nestingRules) {
                  await storage.put('nesting_rules', `${instanceId}:${rule.parent}`, {
                    provider: instanceId,
                    parent: rule.parent,
                    allowedChildren: [...rule.allowedChildren],
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
