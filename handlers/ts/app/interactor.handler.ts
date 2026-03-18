// @migrated dsl-constructs 2026-03-18
// ============================================================
// Interactor Handler
//
// Classifies field types into abstract interaction categories for widget selection.
// The entity category classifies whole-concept rendering (entity-detail, entity-card, etc.).
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const VALID_CATEGORIES = ['selection', 'edit', 'control', 'output', 'navigation', 'composition', 'entity'];

const ENTITY_SUBTYPES = [
  'entity-detail',
  'entity-card',
  'entity-row',
  'entity-inline',
  'entity-editor',
  'entity-graph',
];

// Map from host view context to entity interactor subtype
const VIEW_TO_ENTITY_SUBTYPE: Record<string, string> = {
  detail: 'entity-detail',
  list: 'entity-card',
  'list-table': 'entity-row',
  inline: 'entity-inline',
  edit: 'entity-editor',
  graph: 'entity-graph',
};

let interactorCounter = 0;

/**
 * Classify an entity element into an entity interactor subtype.
 * Pure helper that builds a classification result from constraints and storage results.
 */
function classifyEntityFromData(
  constraints: Record<string, unknown>,
  registered: Record<string, unknown>[],
): Record<string, unknown> {
  const view = (constraints.view as string) || 'detail';
  const concept = constraints.concept as string;
  const suite = constraints.suite as string;
  const tags = (constraints.tags as string[]) || [];

  const subtype = VIEW_TO_ENTITY_SUBTYPE[view] || 'entity-detail';

  const match = registered.find(
    (entry) => entry.name === subtype && entry.category === 'entity',
  );

  if (match) {
    return {
      variant: 'ok',
      interactor: match.interactor as string,
      confidence: 1.0,
      concept,
      suite,
      tags: JSON.stringify(tags),
    };
  }

  return {
    variant: 'ok',
    interactor: subtype,
    confidence: 0.8,
    concept,
    suite,
    tags: JSON.stringify(tags),
  };
}

const _handler: FunctionalConceptHandler = {
  define(input: Record<string, unknown>) {
    const interactor = input.interactor as string;
    const name = input.name as string;
    const category = input.category as string;
    const properties = input.properties as string;

    if (!VALID_CATEGORIES.includes(category)) {
      const p = createProgram();
      return complete(p, 'duplicate', { message: `Invalid category "${category}". Must be one of: ${VALID_CATEGORIES.join(', ')}` }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'interactor', interactor, 'existing');

    return branch(p, 'existing',
      (thenP) => complete(thenP, 'duplicate', { message: 'An interactor with this identity already exists' }),
      (elseP) => {
        const parsedProps = JSON.parse(properties || '{}');
        elseP = put(elseP, 'interactor', interactor, {
          interactor,
          name,
          category,
          properties: JSON.stringify({
            dataType: parsedProps.dataType ?? 'string',
            cardinality: parsedProps.cardinality ?? 'one',
            optionCount: parsedProps.optionCount ?? null,
            optionSource: parsedProps.optionSource ?? null,
            domain: parsedProps.domain ?? null,
            comparison: parsedProps.comparison ?? null,
            mutable: parsedProps.mutable ?? true,
            multiLine: parsedProps.multiLine ?? false,
            concept: parsedProps.concept ?? null,
            suite: parsedProps.suite ?? null,
            tags: parsedProps.tags ?? null,
          }),
          createdAt: new Date().toISOString(),
        });
        interactorCounter++;
        return complete(elseP, 'ok', {});
      },
    ) as StorageProgram<Result>;
  },

  classify(input: Record<string, unknown>) {
    const fieldType = input.fieldType as string;
    const constraints = input.constraints as string;
    const intent = input.intent as string;

    const parsedConstraints = JSON.parse(constraints || '{}');

    // Entity-level classification
    if (fieldType === 'entity') {
      const view = (parsedConstraints.view as string) || 'detail';
      const subtype = VIEW_TO_ENTITY_SUBTYPE[view] || 'entity-detail';

      let p = createProgram();
      p = find(p, 'interactor', { name: subtype }, 'registered');

      return completeFrom(p, 'dynamic', (bindings) => {
        const registered = bindings.registered as Record<string, unknown>[];
        return classifyEntityFromData(parsedConstraints, registered);
      }) as StorageProgram<Result>;
    }

    // Field-level classification
    let p = createProgram();
    p = find(p, 'interactor', {}, 'allInteractors');

    return completeFrom(p, 'dynamic', (bindings) => {
      const allInteractors = bindings.allInteractors as Record<string, unknown>[];

      const candidates: Array<{ interactor: string; confidence: number }> = [];

      for (const entry of allInteractors) {
        if (entry.category === 'entity') continue;

        const props = JSON.parse((entry.properties as string) || '{}');
        let confidence = 0;

        if (props.dataType === fieldType) confidence += 0.4;
        if (parsedConstraints.cardinality && props.cardinality === parsedConstraints.cardinality) confidence += 0.2;
        if (parsedConstraints.mutable !== undefined && props.mutable === parsedConstraints.mutable) confidence += 0.1;
        if (intent && entry.category === intent) confidence += 0.3;

        if (confidence > 0) {
          candidates.push({
            interactor: entry.interactor as string,
            confidence: Math.min(confidence, 1.0),
          });
        }
      }

      if (candidates.length === 0) {
        return { variant: 'ambiguous', candidates: JSON.stringify([]), message: 'No interactors matched the given criteria' };
      }

      candidates.sort((a, b) => b.confidence - a.confidence);

      if (candidates.length === 1 || candidates[0].confidence > candidates[1].confidence + 0.1) {
        return { variant: 'ok', confidence: candidates[0].confidence, interactor: candidates[0].interactor };
      }

      return { variant: 'ambiguous', candidates: JSON.stringify(candidates) };
    }) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const interactor = input.interactor as string;

    let p = createProgram();
    p = get(p, 'interactor', interactor, 'existing');

    return branch(p, 'existing',
      (thenP) => completeFrom(thenP, 'ok', (bindings) => {
        const existing = bindings.existing as Record<string, unknown>;
        return {
          name: existing.name as string,
          category: existing.category as string,
          properties: existing.properties as string,
        };
      }),
      (elseP) => complete(elseP, 'notfound', { message: 'Interactor not found' }),
    ) as StorageProgram<Result>;
  },

  list(input: Record<string, unknown>) {
    const category = input.category as string;

    let p = createProgram();
    p = find(p, 'interactor', {}, 'allInteractors');

    return completeFrom(p, 'ok', (bindings) => {
      const allInteractors = bindings.allInteractors as Record<string, unknown>[];

      const filtered = category
        ? allInteractors.filter((entry) => entry.category === category)
        : allInteractors;

      const interactors = filtered.map((entry) => ({
        interactor: entry.interactor,
        name: entry.name,
        category: entry.category,
      }));

      return { interactors: JSON.stringify(interactors) };
    }) as StorageProgram<Result>;
  },
};

export const interactorHandler = autoInterpret(_handler);
