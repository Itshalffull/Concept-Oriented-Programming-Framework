// Interactor Concept Implementation
// Classifies field types into abstract interaction categories for widget selection.
// The entity category classifies whole-concept rendering (entity-detail, entity-card, etc.).
import type { ConceptHandler } from '@clef/runtime';

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

export const interactorHandler: ConceptHandler = {
  async define(input, storage) {
    const interactor = input.interactor as string;
    const name = input.name as string;
    const category = input.category as string;
    const properties = input.properties as string;

    const existing = await storage.get('interactor', interactor);
    if (existing) {
      return { variant: 'duplicate', message: 'An interactor with this identity already exists' };
    }

    if (!VALID_CATEGORIES.includes(category)) {
      return { variant: 'duplicate', message: `Invalid category "${category}". Must be one of: ${VALID_CATEGORIES.join(', ')}` };
    }

    const parsedProps = JSON.parse(properties || '{}');

    await storage.put('interactor', interactor, {
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

    return { variant: 'ok' };
  },

  async classify(input, storage) {
    const fieldType = input.fieldType as string;
    const constraints = input.constraints as string;
    const intent = input.intent as string;

    const parsedConstraints = JSON.parse(constraints || '{}');

    // Entity-level classification: whole-concept rendering
    if (fieldType === 'entity') {
      return classifyEntity(parsedConstraints, storage);
    }

    // Field-level classification (existing behavior)
    const candidates: Array<{ interactor: string; confidence: number }> = [];

    const results = await storage.find('interactor', fieldType);
    const allInteractors = Array.isArray(results) ? results : [];

    for (const entry of allInteractors) {
      // Skip entity-category interactors for field-level classification
      if (entry.category === 'entity') continue;

      const props = JSON.parse((entry.properties as string) || '{}');
      let confidence = 0;

      if (props.dataType === fieldType) {
        confidence += 0.4;
      }

      if (parsedConstraints.cardinality && props.cardinality === parsedConstraints.cardinality) {
        confidence += 0.2;
      }

      if (parsedConstraints.mutable !== undefined && props.mutable === parsedConstraints.mutable) {
        confidence += 0.1;
      }

      if (intent && entry.category === intent) {
        confidence += 0.3;
      }

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
  },

  async get(input, storage) {
    const interactor = input.interactor as string;

    const existing = await storage.get('interactor', interactor);
    if (!existing) {
      return { variant: 'notfound', message: 'Interactor not found' };
    }

    return {
      variant: 'ok',
      name: existing.name as string,
      category: existing.category as string,
      properties: existing.properties as string,
    };
  },

  async list(input, storage) {
    const category = input.category as string;

    const results = await storage.find('interactor', category);
    const allInteractors = Array.isArray(results) ? results : [];

    const filtered = category
      ? allInteractors.filter((entry) => entry.category === category)
      : allInteractors;

    const interactors = filtered.map((entry) => ({
      interactor: entry.interactor,
      name: entry.name,
      category: entry.category,
    }));

    return { variant: 'ok', interactors: JSON.stringify(interactors) };
  },
};

/**
 * Classify an entity element into an entity interactor subtype.
 * Uses the view context from constraints to determine the subtype
 * (entity-detail, entity-card, entity-row, entity-inline, entity-editor, entity-graph).
 */
async function classifyEntity(
  constraints: Record<string, unknown>,
  storage: Parameters<NonNullable<ConceptHandler['classify']>>[1],
): Promise<Record<string, unknown>> {
  const view = (constraints.view as string) || 'detail';
  const concept = constraints.concept as string;
  const suite = constraints.suite as string;
  const tags = (constraints.tags as string[]) || [];

  // Determine entity subtype from view context
  const subtype = VIEW_TO_ENTITY_SUBTYPE[view] || 'entity-detail';

  // Check if this entity subtype is registered
  const results = await storage.find('interactor', subtype);
  const registered = Array.isArray(results) ? results : [];
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

  // Fallback: return the subtype name even if not pre-registered
  return {
    variant: 'ok',
    interactor: subtype,
    confidence: 0.8,
    concept,
    suite,
    tags: JSON.stringify(tags),
  };
}
