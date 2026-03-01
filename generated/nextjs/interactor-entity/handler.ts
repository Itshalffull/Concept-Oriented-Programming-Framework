// InteractorEntity — Interactor instance entity with lifecycle and widget matching
// Registers interactors by category, classifies fields, and reports coverage.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  InteractorEntityStorage,
  InteractorEntityRegisterInput,
  InteractorEntityRegisterOutput,
  InteractorEntityFindByCategoryInput,
  InteractorEntityFindByCategoryOutput,
  InteractorEntityMatchingWidgetsInput,
  InteractorEntityMatchingWidgetsOutput,
  InteractorEntityClassifiedFieldsInput,
  InteractorEntityClassifiedFieldsOutput,
  InteractorEntityCoverageReportInput,
  InteractorEntityCoverageReportOutput,
  InteractorEntityGetInput,
  InteractorEntityGetOutput,
} from './types.js';

import {
  registerOk,
  findByCategoryOk,
  matchingWidgetsOk,
  classifiedFieldsOk,
  coverageReportOk,
  getOk,
  getNotfound,
} from './types.js';

export interface InteractorEntityError {
  readonly code: string;
  readonly message: string;
}

const storageError = (error: unknown): InteractorEntityError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Classify a property's role based on naming conventions. */
const classifyField = (name: string, type: string): string => {
  if (name.startsWith('on') || name.startsWith('handle') || type.includes('=>')) return 'action';
  if (name.startsWith('is') || name.startsWith('has') || type === 'boolean') return 'flag';
  if (type.includes('[]') || type.startsWith('Array')) return 'collection';
  return 'data';
};

export interface InteractorEntityHandler {
  readonly register: (
    input: InteractorEntityRegisterInput,
    storage: InteractorEntityStorage,
  ) => TE.TaskEither<InteractorEntityError, InteractorEntityRegisterOutput>;
  readonly findByCategory: (
    input: InteractorEntityFindByCategoryInput,
    storage: InteractorEntityStorage,
  ) => TE.TaskEither<InteractorEntityError, InteractorEntityFindByCategoryOutput>;
  readonly matchingWidgets: (
    input: InteractorEntityMatchingWidgetsInput,
    storage: InteractorEntityStorage,
  ) => TE.TaskEither<InteractorEntityError, InteractorEntityMatchingWidgetsOutput>;
  readonly classifiedFields: (
    input: InteractorEntityClassifiedFieldsInput,
    storage: InteractorEntityStorage,
  ) => TE.TaskEither<InteractorEntityError, InteractorEntityClassifiedFieldsOutput>;
  readonly coverageReport: (
    input: InteractorEntityCoverageReportInput,
    storage: InteractorEntityStorage,
  ) => TE.TaskEither<InteractorEntityError, InteractorEntityCoverageReportOutput>;
  readonly get: (
    input: InteractorEntityGetInput,
    storage: InteractorEntityStorage,
  ) => TE.TaskEither<InteractorEntityError, InteractorEntityGetOutput>;
}

// --- Implementation ---

export const interactorEntityHandler: InteractorEntityHandler = {
  register: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const key = `interactor_${input.name}`;
          await storage.put('interactor_entity', key, {
            id: key,
            name: input.name,
            category: input.category,
            properties: input.properties,
            createdAt: new Date().toISOString(),
          });
          return registerOk(key);
        },
        storageError,
      ),
    ),

  findByCategory: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const records = await storage.find('interactor_entity', { category: input.category });
          const interactors = records.map((r) => ({
            id: String(r['id']),
            name: String(r['name']),
          }));
          return findByCategoryOk(JSON.stringify(interactors));
        },
        storageError,
      ),
    ),

  matchingWidgets: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const interactor = await storage.get('interactor_entity', input.interactor);
          if (!interactor) {
            return matchingWidgetsOk(JSON.stringify([]));
          }
          // Find widgets whose required properties match this interactor's properties
          const widgets = await storage.find('widget', { context: input.context });
          const interactorProps = String(interactor['properties'] ?? '{}');
          const matching = widgets.filter((w) => {
            const requiredProps = String(w['requiredProperties'] ?? '{}');
            // Simple check: widget matches if it expects the same or subset of properties
            return requiredProps.length <= interactorProps.length;
          });
          const results = matching.map((w) => ({
            widgetId: String(w['id']),
            name: String(w['name'] ?? w['id']),
          }));
          return matchingWidgetsOk(JSON.stringify(results));
        },
        storageError,
      ),
    ),

  classifiedFields: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const interactor = await storage.get('interactor_entity', input.interactor);
          if (!interactor) {
            return classifiedFieldsOk(JSON.stringify([]));
          }
          const propsStr = String(interactor['properties'] ?? '{}');
          try {
            const props: Record<string, string> = JSON.parse(propsStr);
            const classified = Object.entries(props).map(([name, type]) => ({
              name,
              type,
              classification: classifyField(name, type),
            }));
            return classifiedFieldsOk(JSON.stringify(classified));
          } catch {
            return classifiedFieldsOk(JSON.stringify([]));
          }
        },
        storageError,
      ),
    ),

  coverageReport: (_input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const allInteractors = await storage.find('interactor_entity');
          const allWidgets = await storage.find('widget');
          const total = allInteractors.length;
          const withWidgets = allInteractors.filter((i) =>
            allWidgets.some((w) => String(w['interactor']) === String(i['id'])),
          ).length;
          const report = {
            totalInteractors: total,
            withWidgetBindings: withWidgets,
            coveragePercent: total === 0 ? 100 : Math.round((withWidgets / total) * 100),
            uncovered: allInteractors
              .filter((i) => !allWidgets.some((w) => String(w['interactor']) === String(i['id'])))
              .map((i) => String(i['name'])),
          };
          return coverageReportOk(JSON.stringify(report));
        },
        storageError,
      ),
    ),

  get: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('interactor_entity', input.interactor),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(getNotfound()),
            (found) =>
              TE.right(
                getOk(
                  String(found['id']),
                  String(found['name']),
                  String(found['category']),
                  String(found['properties']),
                ),
              ),
          ),
        ),
      ),
    ),
};
