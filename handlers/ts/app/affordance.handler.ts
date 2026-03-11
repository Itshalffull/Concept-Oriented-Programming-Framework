// Affordance Concept Implementation
// Maps interactor types to concrete widgets based on specificity and contextual conditions.
// Supports concept, suite, and tag conditions for entity-level widget matching,
// plus bind blocks for field-to-contract-slot mapping.
import type { ConceptHandler } from '@clef/runtime';

let affordanceCounter = 0;

export const affordanceHandler: ConceptHandler = {
  async declare(input, storage) {
    const affordance = input.affordance as string;
    const widget = input.widget as string;
    const interactor = input.interactor as string;
    const specificity = input.specificity as number ?? 0;
    const conditions = input.conditions as string;
    const bind = input.bind as string;
    const contractVersion = input.contractVersion as number;
    const densityExempt = input.densityExempt as boolean | undefined;
    const motifOptimized = input.motifOptimized as string | undefined;

    const existing = await storage.get('affordance', affordance);
    if (existing) {
      return { variant: 'duplicate', message: 'An affordance with this identity already exists' };
    }

    const parsedConditions = JSON.parse(conditions || '{}');
    const parsedBind = bind ? JSON.parse(bind) : null;

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
        motif: parsedConditions.motif ?? null,
        mutable: parsedConditions.mutable ?? null,
        concept: parsedConditions.concept ?? null,
        suite: parsedConditions.suite ?? null,
        tags: parsedConditions.tags ?? null,
      }),
      bind: parsedBind ? JSON.stringify(parsedBind) : null,
      contractVersion: contractVersion ?? null,
      densityExempt: densityExempt ?? null,
      motifOptimized: motifOptimized ?? null,
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

      // Evaluate field-level conditions
      if (conditions.platform && parsedContext.platform && conditions.platform !== parsedContext.platform) {
        return false;
      }
      if (conditions.viewport && parsedContext.viewport) {
        if (conditions.viewport !== parsedContext.viewport) return false;
      }
      if (conditions.density && parsedContext.density) {
        if (conditions.density !== parsedContext.density) return false;
      }
      if (conditions.motif && parsedContext.motif) {
        if (conditions.motif !== parsedContext.motif) return false;
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

      // Evaluate entity-level conditions
      if (conditions.concept && parsedContext.concept) {
        if (conditions.concept !== parsedContext.concept) return false;
      }
      if (conditions.suite && parsedContext.suite) {
        if (conditions.suite !== parsedContext.suite) return false;
      }
      if (conditions.tags && Array.isArray(conditions.tags) && parsedContext.tags) {
        const contextTags = Array.isArray(parsedContext.tags) ? parsedContext.tags : JSON.parse(parsedContext.tags);
        const hasAllTags = conditions.tags.every((tag: string) => contextTags.includes(tag));
        if (!hasAllTags) return false;
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
      bind: aff.bind ? JSON.parse(aff.bind as string) : null,
      contractVersion: aff.contractVersion ?? null,
      densityExempt: aff.densityExempt ?? null,
      motifOptimized: aff.motifOptimized ?? null,
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
    if (conditions.motif) conditionParts.push(`motif=${conditions.motif}`);
    if (conditions.mutable !== null) conditionParts.push(`mutable=${conditions.mutable}`);
    if (conditions.minOptions !== null) conditionParts.push(`minOptions=${conditions.minOptions}`);
    if (conditions.maxOptions !== null) conditionParts.push(`maxOptions=${conditions.maxOptions}`);
    if (conditions.concept) conditionParts.push(`concept=${conditions.concept}`);
    if (conditions.suite) conditionParts.push(`suite=${conditions.suite}`);
    if (conditions.tags) conditionParts.push(`tags=${JSON.stringify(conditions.tags)}`);

    const conditionStr = conditionParts.length > 0 ? conditionParts.join(', ') : 'none';
    const bindStr = existing.bind ? `, bind: ${existing.bind}` : '';
    const contractStr = existing.contractVersion ? `, contract: @${existing.contractVersion}` : '';
    const densityStr = existing.densityExempt !== null && existing.densityExempt !== undefined
      ? `, densityExempt: ${existing.densityExempt}`
      : '';
    const motifStr = existing.motifOptimized ? `, motifOptimized: ${existing.motifOptimized}` : '';
    const reason = `Affordance "${existing.affordance}" maps interactor "${existing.interactor}" to widget "${existing.widget}" at specificity ${existing.specificity} with conditions: ${conditionStr}${bindStr}${contractStr}${densityStr}${motifStr}`;

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
