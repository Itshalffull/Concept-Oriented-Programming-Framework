// WidgetEntity — handler.ts
// Surface concept: widget instance entities.
// Creates instances from widget definitions, manages instance state,
// supports composition queries, accessibility audits, and concept tracing.

import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  WidgetEntityStorage,
  WidgetEntityRegisterInput,
  WidgetEntityRegisterOutput,
  WidgetEntityGetInput,
  WidgetEntityGetOutput,
  WidgetEntityFindByAffordanceInput,
  WidgetEntityFindByAffordanceOutput,
  WidgetEntityFindComposingInput,
  WidgetEntityFindComposingOutput,
  WidgetEntityFindComposedByInput,
  WidgetEntityFindComposedByOutput,
  WidgetEntityGeneratedComponentsInput,
  WidgetEntityGeneratedComponentsOutput,
  WidgetEntityAccessibilityAuditInput,
  WidgetEntityAccessibilityAuditOutput,
  WidgetEntityTraceToConceptInput,
  WidgetEntityTraceToConceptOutput,
} from './types.js';

import {
  registerOk,
  registerAlreadyRegistered,
  getOk,
  getNotfound,
  findByAffordanceOk,
  findComposingOk,
  findComposedByOk,
  generatedComponentsOk,
  accessibilityAuditOk,
  accessibilityAuditIncomplete,
  traceToConceptOk,
  traceToConceptNoConceptBinding,
} from './types.js';

export interface WidgetEntityError {
  readonly code: string;
  readonly message: string;
}

export interface WidgetEntityHandler {
  readonly register: (
    input: WidgetEntityRegisterInput,
    storage: WidgetEntityStorage,
  ) => TE.TaskEither<WidgetEntityError, WidgetEntityRegisterOutput>;
  readonly get: (
    input: WidgetEntityGetInput,
    storage: WidgetEntityStorage,
  ) => TE.TaskEither<WidgetEntityError, WidgetEntityGetOutput>;
  readonly findByAffordance: (
    input: WidgetEntityFindByAffordanceInput,
    storage: WidgetEntityStorage,
  ) => TE.TaskEither<WidgetEntityError, WidgetEntityFindByAffordanceOutput>;
  readonly findComposing: (
    input: WidgetEntityFindComposingInput,
    storage: WidgetEntityStorage,
  ) => TE.TaskEither<WidgetEntityError, WidgetEntityFindComposingOutput>;
  readonly findComposedBy: (
    input: WidgetEntityFindComposedByInput,
    storage: WidgetEntityStorage,
  ) => TE.TaskEither<WidgetEntityError, WidgetEntityFindComposedByOutput>;
  readonly generatedComponents: (
    input: WidgetEntityGeneratedComponentsInput,
    storage: WidgetEntityStorage,
  ) => TE.TaskEither<WidgetEntityError, WidgetEntityGeneratedComponentsOutput>;
  readonly accessibilityAudit: (
    input: WidgetEntityAccessibilityAuditInput,
    storage: WidgetEntityStorage,
  ) => TE.TaskEither<WidgetEntityError, WidgetEntityAccessibilityAuditOutput>;
  readonly traceToConcept: (
    input: WidgetEntityTraceToConceptInput,
    storage: WidgetEntityStorage,
  ) => TE.TaskEither<WidgetEntityError, WidgetEntityTraceToConceptOutput>;
}

// --- Domain helpers ---

const mkStorageError = (error: unknown): WidgetEntityError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const REQUIRED_A11Y_ATTRIBUTES = ['role', 'aria-label', 'tabindex'] as const;

const auditAccessibility = (
  ast: Record<string, unknown>,
): { readonly pass: boolean; readonly missing: readonly string[] } => {
  const missing: string[] = [];
  for (const attr of REQUIRED_A11Y_ATTRIBUTES) {
    if (!(attr in ast) || ast[attr] === undefined || ast[attr] === '') {
      missing.push(attr);
    }
  }
  return { pass: missing.length === 0, missing };
};

// --- Implementation ---

export const widgetEntityHandler: WidgetEntityHandler = {
  register: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('entities', input.name),
        mkStorageError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  const entity = {
                    name: input.name,
                    source: input.source,
                    ast: input.ast,
                    createdAt: new Date().toISOString(),
                  };
                  await storage.put('entities', input.name, entity);
                  return registerOk(input.name);
                },
                mkStorageError,
              ),
            () =>
              TE.right(registerAlreadyRegistered(input.name)),
          ),
        ),
      ),
    ),

  get: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('entities', input.name),
        mkStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(getNotfound()),
            (found) => TE.right(getOk(JSON.stringify(found))),
          ),
        ),
      ),
    ),

  findByAffordance: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('affordances', { interactor: input.interactor }),
        mkStorageError,
      ),
      TE.map((records) => {
        const widgetNames = records.map((r) => String(r['widget'] ?? ''));
        const unique = [...new Set(widgetNames)];
        return findByAffordanceOk(JSON.stringify(unique));
      }),
    ),

  findComposing: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('composition', { child: input.widget }),
        mkStorageError,
      ),
      TE.map((records) => {
        const parents = records.map((r) => String(r['parent'] ?? ''));
        return findComposingOk(JSON.stringify(parents));
      }),
    ),

  findComposedBy: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('composition', { parent: input.widget }),
        mkStorageError,
      ),
      TE.map((records) => {
        const children = records.map((r) => String(r['child'] ?? ''));
        return findComposedByOk(JSON.stringify(children));
      }),
    ),

  generatedComponents: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('generated_components', { widget: input.widget }),
        mkStorageError,
      ),
      TE.map((records) => {
        const components = records.map((r) => ({
          name: String(r['component'] ?? ''),
          framework: String(r['framework'] ?? ''),
          path: String(r['path'] ?? ''),
        }));
        return generatedComponentsOk(JSON.stringify(components));
      }),
    ),

  accessibilityAudit: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('entities', input.widget),
        mkStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                accessibilityAuditIncomplete(
                  JSON.stringify([`Widget "${input.widget}" not found`]),
                ),
              ),
            (found) => {
              let ast: Record<string, unknown> = {};
              try {
                ast = typeof found['ast'] === 'string'
                  ? JSON.parse(found['ast'] as string)
                  : (found['ast'] as Record<string, unknown>) ?? {};
              } catch {
                ast = {};
              }
              const result = auditAccessibility(ast);
              if (result.pass) {
                return TE.right(
                  accessibilityAuditOk(
                    JSON.stringify({
                      widget: input.widget,
                      status: 'pass',
                      checks: REQUIRED_A11Y_ATTRIBUTES.length,
                    }),
                  ),
                );
              }
              return TE.right(
                accessibilityAuditIncomplete(JSON.stringify(result.missing)),
              );
            },
          ),
        ),
      ),
    ),

  traceToConcept: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('concept_bindings', { widget: input.widget }),
        mkStorageError,
      ),
      TE.map((records) => {
        if (records.length === 0) {
          return traceToConceptNoConceptBinding();
        }
        const concepts = records.map((r) => String(r['concept'] ?? ''));
        const unique = [...new Set(concepts)];
        return traceToConceptOk(JSON.stringify(unique));
      }),
    ),
};
