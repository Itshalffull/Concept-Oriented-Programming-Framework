// @migrated dsl-constructs 2026-03-18
// ============================================================
// InteractorEntity Handler
//
// Queryable representation of a registered interactor type --
// the abstract interaction taxonomy as a traversable node. Enables
// queries like "what fields classify as this interactor?" and "what
// widgets match this interactor in a given context?"
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

let idCounter = 0;
function nextId(): string {
  return `interactor-entity-${++idCounter}`;
}

type Result = { variant: string; [key: string]: unknown };

const _interactorEntityHandler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const name = input.name as string;
    const category = input.category as string;
    const properties = input.properties as string;

    const id = nextId();
    const symbol = `clef/interactor/${name}`;

    let p = createProgram();
    p = put(p, 'interactor-entity', id, {
      id,
      name,
      symbol,
      category,
      properties,
      classificationRules: '[]',
    });
    return complete(p, 'ok', { entity: id }) as StorageProgram<Result>;
  },

  findByCategory(input: Record<string, unknown>) {
    const category = input.category as string;

    let p = createProgram();
    p = find(p, 'interactor-entity', { category }, 'results');
    return completeFrom(p, 'ok', (bindings) => ({
      interactors: JSON.stringify(bindings.results),
    })) as StorageProgram<Result>;
  },

  matchingWidgets(input: Record<string, unknown>) {
    const interactor = input.interactor as string;
    const context = input.context as string;

    let p = createProgram();
    p = get(p, 'interactor-entity', interactor, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = find(b, 'widget-entity', {}, 'allWidgets');
        b2 = mapBindings(b2, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const interactorName = record.name as string;
          const allWidgets = (bindings.allWidgets as Array<Record<string, unknown>>) || [];

          const matching = allWidgets.filter((w) => {
            try {
              const ast = JSON.parse(w.ast as string || '{}');
              const affordances = ast.affordances || [];
              return affordances.some((a: Record<string, unknown>) => a.interactor === interactorName);
            } catch {
              return false;
            }
          }).map((w) => ({
            widget: w.name,
            affordanceSpecificity: 1,
            conditionsMet: true,
          }));

          return JSON.stringify(matching);
        }, 'widgets');
        return completeFrom(b2, 'ok', (bindings) => ({ widgets: bindings.widgets as string }));
      },
      (b) => complete(b, 'ok', { widgets: '[]' }),
    );

    return p as StorageProgram<Result>;
  },

  classifiedFields(input: Record<string, unknown>) {
    const interactor = input.interactor as string;

    let p = createProgram();
    p = get(p, 'interactor-entity', interactor, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = find(b, 'state-field', {}, 'allFields');
        b2 = mapBindings(b2, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          let props: Record<string, unknown> = {};
          try {
            props = JSON.parse(record.properties as string || '{}');
          } catch {
            // empty
          }

          const allFields = (bindings.allFields as Array<Record<string, unknown>>) || [];
          const classified = allFields.filter((f) => {
            const dataType = props.dataType as string | undefined;
            const cardinality = props.cardinality as string | undefined;
            if (dataType && f.typeExpr && !(f.typeExpr as string).includes(dataType)) return false;
            if (cardinality && f.cardinality !== cardinality) return false;
            return true;
          }).map((f) => ({
            concept: f.concept,
            field: f.name,
            confidence: 1.0,
          }));

          return JSON.stringify(classified);
        }, 'fields');
        return completeFrom(b2, 'ok', (bindings) => ({ fields: bindings.fields as string }));
      },
      (b) => complete(b, 'ok', { fields: '[]' }),
    );

    return p as StorageProgram<Result>;
  },

  coverageReport(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'interactor-entity', {}, 'allInteractors');
    p = find(p, 'widget-entity', {}, 'allWidgets');

    p = mapBindings(p, (bindings) => {
      const allInteractors = (bindings.allInteractors as Array<Record<string, unknown>>) || [];
      const allWidgets = (bindings.allWidgets as Array<Record<string, unknown>>) || [];

      const report = allInteractors.map((interactor) => {
        const interactorName = interactor.name as string;

        const matchingWidgets = allWidgets.filter((w) => {
          try {
            const ast = JSON.parse(w.ast as string || '{}');
            const affordances = ast.affordances || [];
            return affordances.some((a: Record<string, unknown>) => a.interactor === interactorName);
          } catch {
            return false;
          }
        });

        return {
          interactor: interactorName,
          widgetCount: matchingWidgets.length,
          uncoveredContexts: [] as string[],
        };
      });

      return JSON.stringify(report);
    }, 'report');

    return completeFrom(p, 'ok', (bindings) => ({ report: bindings.report as string })) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const interactor = input.interactor as string;

    let p = createProgram();
    p = get(p, 'interactor-entity', interactor, 'record');

    p = branch(p, 'record',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        return {
          interactor: record.id as string,
          name: record.name as string,
          category: record.category as string,
          properties: record.properties as string,
        };
      }),
      (b) => complete(b, 'notfound', {}),
    );

    return p as StorageProgram<Result>;
  },
};

export const interactorEntityHandler = autoInterpret(_interactorEntityHandler);

/** Reset the ID counter. Useful for testing. */
export function resetInteractorEntityCounter(): void {
  idCounter = 0;
}
