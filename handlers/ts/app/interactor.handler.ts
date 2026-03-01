// Interactor Concept Implementation
// Classifies field types into abstract interaction categories for widget selection.
import type { ConceptHandler } from '@clef/runtime';

const VALID_CATEGORIES = ['selection', 'edit', 'control', 'output', 'navigation', 'composition'];

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

    // Build a classification based on field type, constraints, and intent
    const candidates: Array<{ interactor: string; confidence: number }> = [];

    const results = await storage.find('interactor', fieldType);
    const allInteractors = Array.isArray(results) ? results : [];

    for (const entry of allInteractors) {
      const props = JSON.parse((entry.properties as string) || '{}');
      let confidence = 0;

      // Score based on data type match
      if (props.dataType === fieldType) {
        confidence += 0.4;
      }

      // Score based on cardinality match
      if (parsedConstraints.cardinality && props.cardinality === parsedConstraints.cardinality) {
        confidence += 0.2;
      }

      // Score based on mutability match
      if (parsedConstraints.mutable !== undefined && props.mutable === parsedConstraints.mutable) {
        confidence += 0.1;
      }

      // Score based on intent match against category
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

    // If top candidate is clearly ahead, return it; otherwise report ambiguity
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
