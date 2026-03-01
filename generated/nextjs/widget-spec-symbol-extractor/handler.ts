// Widget spec symbol extraction — names, props, events, slots, and state declarations.
// Builds a symbol table from widget specs for cross-referencing and code generation.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  WidgetSpecSymbolExtractorStorage,
  WidgetSpecSymbolExtractorInitializeInput,
  WidgetSpecSymbolExtractorInitializeOutput,
} from './types.js';

import {
  initializeOk,
  initializeLoadError,
} from './types.js';

export interface WidgetSpecSymbolExtractorError {
  readonly code: string;
  readonly message: string;
}

export interface WidgetSpecSymbolExtractorHandler {
  readonly initialize: (
    input: WidgetSpecSymbolExtractorInitializeInput,
    storage: WidgetSpecSymbolExtractorStorage,
  ) => TE.TaskEither<WidgetSpecSymbolExtractorError, WidgetSpecSymbolExtractorInitializeOutput>;
}

// --- Pure helpers ---

/** Symbol kinds extractable from widget specs */
type WidgetSymbolKind =
  | 'widget'
  | 'prop'
  | 'slot'
  | 'event'
  | 'state-field'
  | 'computed'
  | 'action'
  | 'style-class'
  | 'ref'
  | 'component-ref';

/** Extraction rule for each widget symbol kind */
interface WidgetExtractionRule {
  readonly symbolKind: WidgetSymbolKind;
  readonly nodeType: string;
  readonly nameField: string;
  readonly hasType: boolean;
  readonly hasDefault: boolean;
  readonly isPublic: boolean;
}

/** Build extraction rules for all widget symbol kinds */
const buildExtractionRules = (): readonly WidgetExtractionRule[] => [
  { symbolKind: 'widget', nodeType: 'widget_declaration', nameField: 'name', hasType: false, hasDefault: false, isPublic: true },
  { symbolKind: 'prop', nodeType: 'prop_declaration', nameField: 'name', hasType: true, hasDefault: true, isPublic: true },
  { symbolKind: 'slot', nodeType: 'slot_declaration', nameField: 'name', hasType: false, hasDefault: true, isPublic: true },
  { symbolKind: 'event', nodeType: 'event_declaration', nameField: 'name', hasType: true, hasDefault: false, isPublic: true },
  { symbolKind: 'state-field', nodeType: 'state_declaration', nameField: 'name', hasType: true, hasDefault: true, isPublic: false },
  { symbolKind: 'computed', nodeType: 'computed_declaration', nameField: 'name', hasType: true, hasDefault: false, isPublic: false },
  { symbolKind: 'action', nodeType: 'action_declaration', nameField: 'name', hasType: true, hasDefault: false, isPublic: false },
  { symbolKind: 'style-class', nodeType: 'style_declaration', nameField: 'class', hasType: false, hasDefault: false, isPublic: false },
  { symbolKind: 'ref', nodeType: 'ref_declaration', nameField: 'name', hasType: true, hasDefault: false, isPublic: false },
  { symbolKind: 'component-ref', nodeType: 'component_reference', nameField: 'name', hasType: false, hasDefault: false, isPublic: false },
];

/** Symbol visibility for generated code */
type SymbolVisibility = 'public-api' | 'internal' | 'inherited';

/** Determine visibility based on extraction rule */
const determineVisibility = (rule: WidgetExtractionRule): SymbolVisibility => {
  if (rule.isPublic) return 'public-api';
  return 'internal';
};

/** Validate that all essential widget symbol kinds have rules */
const validateRuleCoverage = (
  rules: readonly WidgetExtractionRule[],
): O.Option<string> => {
  const essential: readonly WidgetSymbolKind[] = ['widget', 'prop', 'slot', 'event', 'state-field'];
  const covered = new Set(rules.map((r) => r.symbolKind));
  const missing = essential.filter((e) => !covered.has(e));
  return missing.length > 0
    ? O.some(`Missing widget symbol extraction rules: ${missing.join(', ')}`)
    : O.none;
};

const toStorageError = (error: unknown): WidgetSpecSymbolExtractorError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const widgetSpecSymbolExtractorHandler: WidgetSpecSymbolExtractorHandler = {
  initialize: (_input, storage) => {
    const rules = buildExtractionRules();
    return pipe(
      validateRuleCoverage(rules),
      O.fold(
        () =>
          pipe(
            TE.tryCatch(
              async () => {
                const instanceId = `widget-symbol-extractor-${Date.now()}`;

                const publicKinds = rules
                  .filter((r) => r.isPublic)
                  .map((r) => r.symbolKind);
                const typedKinds = rules
                  .filter((r) => r.hasType)
                  .map((r) => r.symbolKind);

                await storage.put('extractors', instanceId, {
                  instanceId,
                  specType: 'widget',
                  symbolKinds: rules.map((r) => r.symbolKind),
                  publicKinds,
                  typedKinds,
                  ruleCount: rules.length,
                  initializedAt: new Date().toISOString(),
                });

                // Persist each extraction rule for runtime lookup
                for (const rule of rules) {
                  await storage.put('extraction_rules', `${instanceId}:${rule.symbolKind}`, {
                    extractor: instanceId,
                    symbolKind: rule.symbolKind,
                    nodeType: rule.nodeType,
                    nameField: rule.nameField,
                    hasType: rule.hasType,
                    hasDefault: rule.hasDefault,
                    isPublic: rule.isPublic,
                    visibility: determineVisibility(rule),
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
