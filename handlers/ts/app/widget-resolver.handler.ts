// WidgetResolver Concept Implementation
// Scores and selects the best widget for a given interface element based on context and overrides.
import type { ConceptHandler } from '@clef/runtime';

let resolverCounter = 0;

export const widgetResolverHandler: ConceptHandler = {
  async resolve(input, storage) {
    const resolver = input.resolver as string;
    const element = input.element as string;
    const context = input.context as string;

    const parsedContext = JSON.parse(context || '{}');

    // Check for manual overrides first
    const resolverRecord = await storage.get('resolver', resolver);
    const overrides = resolverRecord
      ? JSON.parse((resolverRecord.overrides as string) || '{}')
      : {};
    const weights = resolverRecord
      ? JSON.parse((resolverRecord.scoringWeights as string) || '{}')
      : { specificity: 0.4, conditionMatch: 0.3, popularity: 0.2, recency: 0.1 };

    if (overrides[element]) {
      return {
        variant: 'ok',
        widget: overrides[element],
        score: 1.0,
        reason: 'Manual override applied',
      };
    }

    // Look up affordances for the element type
    const affordanceResults = await storage.find('affordance', element);
    const affordances = Array.isArray(affordanceResults) ? affordanceResults : [];

    if (affordances.length === 0) {
      return { variant: 'none', message: `No widgets found for element "${element}"` };
    }

    // Score each candidate widget
    const candidates: Array<{ widget: string; score: number; reason: string }> = [];

    for (const aff of affordances) {
      const conditions = JSON.parse((aff.conditions as string) || '{}');
      let score = 0;

      // Specificity score
      const specificity = (aff.specificity as number) || 0;
      score += (specificity / 100) * (weights.specificity || 0.4);

      // Condition match score
      let conditionMatches = 0;
      let conditionTotal = 0;
      for (const [key, value] of Object.entries(conditions)) {
        if (value !== null) {
          conditionTotal++;
          if (parsedContext[key] === value) {
            conditionMatches++;
          }
        }
      }
      if (conditionTotal > 0) {
        score += (conditionMatches / conditionTotal) * (weights.conditionMatch || 0.3);
      } else {
        score += weights.conditionMatch || 0.3;
      }

      candidates.push({
        widget: aff.widget as string,
        score: Math.round(score * 1000) / 1000,
        reason: `specificity=${specificity}, conditionMatch=${conditionMatches}/${conditionTotal}`,
      });
    }

    candidates.sort((a, b) => b.score - a.score);

    if (candidates.length === 1 || candidates[0].score > candidates[1].score) {
      return {
        variant: 'ok',
        widget: candidates[0].widget,
        score: candidates[0].score,
        reason: candidates[0].reason,
      };
    }

    return {
      variant: 'ambiguous',
      candidates: JSON.stringify(candidates),
    };
  },

  async resolveAll(input, storage) {
    const resolver = input.resolver as string;
    const elements = input.elements as string;
    const context = input.context as string;

    const parsedElements: string[] = JSON.parse(elements || '[]');
    const resolved: Array<{ element: string; widget: string; score: number }> = [];
    const unresolved: string[] = [];

    for (const element of parsedElements) {
      const result = await (this as ConceptHandler).resolve!(
        { resolver, element, context },
        storage,
      );

      if (result.variant === 'ok') {
        resolved.push({
          element,
          widget: result.widget as string,
          score: result.score as number,
        });
      } else {
        unresolved.push(element);
      }
    }

    if (unresolved.length === 0) {
      return { variant: 'ok', resolutions: JSON.stringify(resolved) };
    }

    return {
      variant: 'partial',
      resolved: JSON.stringify(resolved),
      unresolved: JSON.stringify(unresolved),
    };
  },

  async override(input, storage) {
    const resolver = input.resolver as string;
    const element = input.element as string;
    const widget = input.widget as string;

    if (!element || !widget) {
      return { variant: 'invalid', message: 'Both element and widget are required for override' };
    }

    const resolverRecord = await storage.get('resolver', resolver);
    const overrides = resolverRecord
      ? JSON.parse((resolverRecord.overrides as string) || '{}')
      : {};

    overrides[element] = widget;

    resolverCounter++;

    await storage.put('resolver', resolver, {
      resolver,
      overrides: JSON.stringify(overrides),
      defaultContext: resolverRecord?.defaultContext ?? '{}',
      scoringWeights: resolverRecord?.scoringWeights ?? JSON.stringify({
        specificity: 0.4,
        conditionMatch: 0.3,
        popularity: 0.2,
        recency: 0.1,
      }),
      updatedAt: new Date().toISOString(),
    });

    return { variant: 'ok' };
  },

  async setWeights(input, storage) {
    const resolver = input.resolver as string;
    const weights = input.weights as string;

    let parsedWeights: Record<string, number>;
    try {
      parsedWeights = JSON.parse(weights || '{}');
    } catch {
      return { variant: 'invalid', message: 'Weights must be valid JSON' };
    }

    // Validate weights sum roughly to 1.0
    const sum = Object.values(parsedWeights).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1.0) > 0.01) {
      return { variant: 'invalid', message: `Weights must sum to 1.0, got ${sum}` };
    }

    const resolverRecord = await storage.get('resolver', resolver);

    await storage.put('resolver', resolver, {
      resolver,
      overrides: resolverRecord?.overrides ?? '{}',
      defaultContext: resolverRecord?.defaultContext ?? '{}',
      scoringWeights: JSON.stringify(parsedWeights),
      updatedAt: new Date().toISOString(),
    });

    return { variant: 'ok' };
  },

  async explain(input, storage) {
    const resolver = input.resolver as string;
    const element = input.element as string;
    const context = input.context as string;

    const resolverRecord = await storage.get('resolver', resolver);
    if (!resolverRecord) {
      return { variant: 'notfound', message: `Resolver "${resolver}" not found` };
    }

    const overrides = JSON.parse((resolverRecord.overrides as string) || '{}');
    const weights = JSON.parse((resolverRecord.scoringWeights as string) || '{}');

    const steps: string[] = [];

    // Check override
    if (overrides[element]) {
      steps.push(`Override found: element "${element}" -> widget "${overrides[element]}"`);
      steps.push('Resolution short-circuited by manual override');
    } else {
      steps.push(`No override for element "${element}"`);
      steps.push(`Scoring weights: ${JSON.stringify(weights)}`);

      const affordanceResults = await storage.find('affordance', element);
      const affordances = Array.isArray(affordanceResults) ? affordanceResults : [];

      steps.push(`Found ${affordances.length} candidate affordance(s)`);

      for (const aff of affordances) {
        steps.push(`  - widget="${aff.widget}", specificity=${aff.specificity}`);
      }
    }

    return {
      variant: 'ok',
      explanation: JSON.stringify({
        element,
        context: JSON.parse(context || '{}'),
        steps,
      }),
    };
  },
};
