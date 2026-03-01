// Affordance Concept Implementation
// Maps interactor types to concrete widgets based on specificity and contextual conditions.
import type { ConceptHandler } from '@clef/runtime';

let affordanceCounter = 0;

export const affordanceHandler: ConceptHandler = {
  async declare(input, storage) {
    const affordance = input.affordance as string;
    const widget = input.widget as string;
    const interactor = input.interactor as string;
    const specificity = input.specificity as number ?? 0;
    const conditions = input.conditions as string;

    const existing = await storage.get('affordance', affordance);
    if (existing) {
      return { variant: 'duplicate', message: 'An affordance with this identity already exists' };
    }

    const parsedConditions = JSON.parse(conditions || '{}');

    await storage.put('affordance', affordance, {
      affordance,
      widget,
      interactor,
      specificity,
      conditions: JSON.stringify({
        minOptions: parsedConditions.minOptions ?? null,
        maxOptions: parsedConditions.maxOptions ?? null,
        platform: parsedConditions.platform ?? null,
        viewport: parsedConditions.viewport ?? null,
        density: parsedConditions.density ?? null,
        mutable: parsedConditions.mutable ?? null,
      }),
      createdAt: new Date().toISOString(),
    });

    affordanceCounter++;

    return { variant: 'ok' };
  },

  async match(input, storage) {
    const interactor = input.interactor as string;
    const context = input.context as string;

    const parsedContext = JSON.parse(context || '{}');
    const results = await storage.find('affordance', interactor);
    const allAffordances = Array.isArray(results) ? results : [];

    // Filter affordances matching the interactor type
    const matching = allAffordances.filter((aff) => {
      if (aff.interactor !== interactor) return false;

      const conditions = JSON.parse((aff.conditions as string) || '{}');

      // Evaluate each condition against the context
      if (conditions.platform && parsedContext.platform && conditions.platform !== parsedContext.platform) {
        return false;
      }
      if (conditions.viewport && parsedContext.viewport) {
        if (conditions.viewport !== parsedContext.viewport) return false;
      }
      if (conditions.density && parsedContext.density) {
        if (conditions.density !== parsedContext.density) return false;
      }
      if (conditions.mutable !== null && parsedContext.mutable !== undefined) {
        if (conditions.mutable !== parsedContext.mutable) return false;
      }
      if (conditions.minOptions !== null && parsedContext.optionCount !== undefined) {
        if (parsedContext.optionCount < conditions.minOptions) return false;
      }
      if (conditions.maxOptions !== null && parsedContext.optionCount !== undefined) {
        if (parsedContext.optionCount > conditions.maxOptions) return false;
      }

      return true;
    });

    if (matching.length === 0) {
      return { variant: 'none', message: 'No affordances match the given interactor and context' };
    }

    // Sort by specificity descending
    matching.sort((a, b) => (b.specificity as number) - (a.specificity as number));

    const matches = matching.map((aff) => ({
      affordance: aff.affordance,
      widget: aff.widget,
      specificity: aff.specificity,
    }));

    return { variant: 'ok', matches: JSON.stringify(matches) };
  },

  async explain(input, storage) {
    const affordance = input.affordance as string;

    const existing = await storage.get('affordance', affordance);
    if (!existing) {
      return { variant: 'notfound', message: 'Affordance not found' };
    }

    const conditions = JSON.parse((existing.conditions as string) || '{}');
    const conditionParts: string[] = [];

    if (conditions.platform) conditionParts.push(`platform=${conditions.platform}`);
    if (conditions.viewport) conditionParts.push(`viewport=${conditions.viewport}`);
    if (conditions.density) conditionParts.push(`density=${conditions.density}`);
    if (conditions.mutable !== null) conditionParts.push(`mutable=${conditions.mutable}`);
    if (conditions.minOptions !== null) conditionParts.push(`minOptions=${conditions.minOptions}`);
    if (conditions.maxOptions !== null) conditionParts.push(`maxOptions=${conditions.maxOptions}`);

    const conditionStr = conditionParts.length > 0 ? conditionParts.join(', ') : 'none';
    const reason = `Affordance "${existing.affordance}" maps interactor "${existing.interactor}" to widget "${existing.widget}" at specificity ${existing.specificity} with conditions: ${conditionStr}`;

    return { variant: 'ok', reason };
  },

  async remove(input, storage) {
    const affordance = input.affordance as string;

    const existing = await storage.get('affordance', affordance);
    if (!existing) {
      return { variant: 'notfound', message: 'Affordance not found' };
    }

    await storage.put('affordance', affordance, {
      __deleted: true,
    });

    return { variant: 'ok' };
  },
};
