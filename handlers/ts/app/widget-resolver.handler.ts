// WidgetResolver Concept Implementation
// Scores and selects the best widget for a given interface element based on context and overrides.
// For entity-level elements, performs contract validation: verifies the widget's requires block
// is satisfied by the concept's fields, using explicit bind mappings and exact-name matching.
import type { ConceptHandler } from '@clef/runtime';

interface ContractSlot {
  name: string;
  type: string;
}

interface ContractRequires {
  version?: number;
  fields?: ContractSlot[];
  actions?: Array<{ name: string }>;
  secondaryRoles?: Array<{
    name: string;
    source: string;
    relation: string;
    optional: boolean;
    fields?: ContractSlot[];
    actions?: Array<{ name: string }>;
  }>;
}

interface ResolvedSlot {
  slot: string;
  source: 'bind' | 'exact-name';
  field: string;
  type: string;
}

interface ContractValidationResult {
  status: 'ok' | 'error';
  resolvedSlots: ResolvedSlot[];
  unresolvedSlots: string[];
  typeMismatches: Array<{ slot: string; expected: string; actual: string }>;
  missingActions: string[];
  bindingMap: Record<string, string>;
}

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
        bindingMap: null,
      };
    }

    // Look up affordances for the element type
    const affordanceResults = await storage.find('affordance', element);
    const affordances = Array.isArray(affordanceResults) ? affordanceResults : [];

    if (affordances.length === 0) {
      return { variant: 'none', message: `No widgets found for element "${element}"` };
    }

    // Determine if this is an entity-level resolution
    const isEntityResolution = parsedContext.concept !== undefined;

    // Build concept field/action data for contract validation
    const conceptFields: Array<{ name: string; type: string }> = parsedContext.fields || [];
    const conceptActions: string[] = parsedContext.actions || [];

    // Score and validate each candidate widget
    const candidates: Array<{
      widget: string;
      score: number;
      reason: string;
      bindingMap: Record<string, string> | null;
      contractResult: string;
      errors: Array<{ slot: string; reason: string }>;
    }> = [];
    const diagnostics: typeof candidates = [];

    for (const aff of affordances) {
      const conditions = JSON.parse((aff.conditions as string) || '{}');
      const bindMap = aff.bind ? JSON.parse(aff.bind as string) : {};
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

      // For entity-level resolution, validate the widget contract
      if (isEntityResolution) {
        const widgetRecord = await storage.get('widget', aff.widget as string);
        const requires = widgetRecord?.requires
          ? JSON.parse(widgetRecord.requires as string)
          : null;

        if (requires) {
          const validation = validateContract(requires, conceptFields, conceptActions, bindMap);

          if (validation.status === 'error') {
            // Disqualified — record diagnostic but don't add to candidates
            diagnostics.push({
              widget: aff.widget as string,
              score: 0,
              reason: `Contract validation failed`,
              bindingMap: null,
              contractResult: 'error',
              errors: [
                ...validation.unresolvedSlots.map((s) => ({ slot: s, reason: 'unresolved: no exact-name match, no bind mapping' })),
                ...validation.typeMismatches.map((m) => ({ slot: m.slot, reason: `type mismatch: expected ${m.expected}, got ${m.actual}` })),
              ],
            });
            continue;
          }

          candidates.push({
            widget: aff.widget as string,
            score: Math.round(score * 1000) / 1000,
            reason: `specificity=${specificity}, conditionMatch=${conditionMatches}/${conditionTotal}, contract=ok`,
            bindingMap: validation.bindingMap,
            contractResult: 'ok',
            errors: [],
          });
        } else {
          // No contract — widget is a valid candidate (generic entity widget)
          candidates.push({
            widget: aff.widget as string,
            score: Math.round(score * 1000) / 1000,
            reason: `specificity=${specificity}, conditionMatch=${conditionMatches}/${conditionTotal}, no contract`,
            bindingMap: null,
            contractResult: 'no-contract',
            errors: [],
          });
        }
      } else {
        // Field-level resolution (existing behavior, no contract validation)
        candidates.push({
          widget: aff.widget as string,
          score: Math.round(score * 1000) / 1000,
          reason: `specificity=${specificity}, conditionMatch=${conditionMatches}/${conditionTotal}`,
          bindingMap: null,
          contractResult: 'n/a',
          errors: [],
        });
      }
    }

    // Store diagnostics for explain
    if (diagnostics.length > 0 || candidates.length > 0) {
      const diagKey = `diag:${element}`;
      await storage.put('diagnostics', diagKey, {
        element,
        candidates: JSON.stringify(candidates),
        disqualified: JSON.stringify(diagnostics),
        timestamp: new Date().toISOString(),
      });
    }

    if (candidates.length === 0) {
      return { variant: 'none', message: `No widgets found for element "${element}"` };
    }

    candidates.sort((a, b) => b.score - a.score);

    if (candidates.length === 1 || candidates[0].score > candidates[1].score) {
      return {
        variant: 'ok',
        widget: candidates[0].widget,
        score: candidates[0].score,
        reason: candidates[0].reason,
        bindingMap: candidates[0].bindingMap ? JSON.stringify(candidates[0].bindingMap) : null,
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

    // Retrieve stored diagnostics
    const diagKey = `diag:${element}`;
    const diagRecord = await storage.get('diagnostics', diagKey);

    const explanation: Record<string, unknown> = {
      element,
      context: JSON.parse(context || '{}'),
      steps: [] as string[],
    };

    const steps = explanation.steps as string[];

    if (overrides[element]) {
      steps.push(`Override found: element "${element}" -> widget "${overrides[element]}"`);
      steps.push('Resolution short-circuited by manual override');
    } else {
      steps.push(`No override for element "${element}"`);
      steps.push(`Scoring weights: ${JSON.stringify(weights)}`);

      if (diagRecord) {
        const candidates = JSON.parse((diagRecord.candidates as string) || '[]');
        const disqualified = JSON.parse((diagRecord.disqualified as string) || '[]');

        steps.push(`Found ${candidates.length} valid candidate(s), ${disqualified.length} disqualified`);

        for (const c of candidates) {
          steps.push(`  ✓ widget="${c.widget}", score=${c.score}, contract=${c.contractResult}`);
          if (c.bindingMap) {
            steps.push(`    bindingMap: ${JSON.stringify(c.bindingMap)}`);
          }
        }

        for (const d of disqualified) {
          steps.push(`  ✗ widget="${d.widget}", contract=error`);
          for (const e of d.errors) {
            steps.push(`    slot "${e.slot}": ${e.reason}`);
          }
        }
      } else {
        const affordanceResults = await storage.find('affordance', element);
        const affordances = Array.isArray(affordanceResults) ? affordanceResults : [];
        steps.push(`Found ${affordances.length} candidate affordance(s)`);
        for (const aff of affordances) {
          steps.push(`  - widget="${aff.widget}", specificity=${aff.specificity}`);
        }
      }
    }

    return {
      variant: 'ok',
      explanation: JSON.stringify(explanation),
    };
  },
};

/**
 * Validate a widget contract against a concept's fields and actions.
 * Uses explicit bind mappings first, then exact-name matching.
 * No type-based inference — ambiguity is always reported.
 */
function validateContract(
  requires: ContractRequires,
  conceptFields: Array<{ name: string; type: string }>,
  conceptActions: string[],
  bindMap: Record<string, string>,
): ContractValidationResult {
  const resolvedSlots: ResolvedSlot[] = [];
  const unresolvedSlots: string[] = [];
  const typeMismatches: Array<{ slot: string; expected: string; actual: string }> = [];
  const missingActions: string[] = [];
  const bindingMap: Record<string, string> = {};

  // Resolve primary fields
  const contractFields = requires.fields || [];
  for (const slot of contractFields) {
    // Strategy 1: Explicit bind mapping
    if (bindMap[slot.name]) {
      const mappedFieldName = bindMap[slot.name];
      const conceptField = conceptFields.find((f) => f.name === mappedFieldName);

      if (conceptField) {
        // Type compatibility check (basic: same type or compatible)
        if (slot.type !== 'Object' && conceptField.type !== 'Object' &&
            !isTypeCompatible(slot.type, conceptField.type)) {
          typeMismatches.push({ slot: slot.name, expected: slot.type, actual: conceptField.type });
        } else {
          resolvedSlots.push({
            slot: slot.name,
            source: 'bind',
            field: mappedFieldName,
            type: conceptField.type,
          });
          bindingMap[slot.name] = mappedFieldName;
        }
        continue;
      }
      // Bind target doesn't exist in concept — fall through to unresolved
    }

    // Strategy 2: Exact name match
    const exactMatch = conceptFields.find((f) => f.name === slot.name);
    if (exactMatch) {
      if (slot.type !== 'Object' && exactMatch.type !== 'Object' &&
          !isTypeCompatible(slot.type, exactMatch.type)) {
        typeMismatches.push({ slot: slot.name, expected: slot.type, actual: exactMatch.type });
      } else {
        resolvedSlots.push({
          slot: slot.name,
          source: 'exact-name',
          field: slot.name,
          type: exactMatch.type,
        });
        bindingMap[slot.name] = slot.name;
      }
      continue;
    }

    // No match found
    unresolvedSlots.push(slot.name);
  }

  // Resolve actions
  const contractActions = requires.actions || [];
  for (const action of contractActions) {
    if (bindMap[action.name]) {
      const mappedAction = bindMap[action.name];
      if (conceptActions.includes(mappedAction)) {
        bindingMap[action.name] = mappedAction;
        continue;
      }
    }

    if (conceptActions.includes(action.name)) {
      bindingMap[action.name] = action.name;
      continue;
    }

    missingActions.push(action.name);
  }

  const hasErrors = unresolvedSlots.length > 0 || typeMismatches.length > 0;

  return {
    status: hasErrors ? 'error' : 'ok',
    resolvedSlots,
    unresolvedSlots,
    typeMismatches,
    missingActions,
    bindingMap,
  };
}

/**
 * Basic type compatibility check.
 * Treats 'enum' as compatible with 'String', 'entity' as compatible with any reference type.
 */
function isTypeCompatible(expected: string, actual: string): boolean {
  if (expected === actual) return true;
  if (expected === 'enum' && (actual === 'String' || actual.includes('enum'))) return true;
  if (expected === 'entity' && (actual.includes('->') || actual === 'String')) return true;
  if (expected === 'String') return true; // String is the universal fallback
  if (expected === 'collection' && (actual.startsWith('list') || actual.startsWith('set'))) return true;
  return false;
}
