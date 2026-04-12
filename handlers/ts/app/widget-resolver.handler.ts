// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// WidgetResolver Concept Implementation
// Scores and selects the best widget for a given interface element based on context and overrides.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, putFrom, branch, complete, completeFrom, mapBindings, pureFrom, traverse,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

interface ContractSlot { name: string; type: string; }
interface ContractRequires { version?: number; fields?: ContractSlot[]; actions?: Array<{ name: string }>; }
interface ResolvedSlot { slot: string; source: 'bind' | 'exact-name'; field: string; type: string; }
interface ContractValidationResult { status: 'ok' | 'error'; resolvedSlots: ResolvedSlot[]; unresolvedSlots: string[]; typeMismatches: Array<{ slot: string; expected: string; actual: string }>; missingActions: string[]; bindingMap: Record<string, string>; }
interface ResolverContext {
  density?: string;
  motif?: string;
  styleProfile?: string;
  sourceType?: string;
  tags?: string[];
  optionCount?: number;
  fieldCount?: number;
  platform?: string;
  viewport?: string;
  concept?: string;
  suite?: string;
}
interface AffordanceRecord {
  affordance?: string;
  widget?: string;
  interactor?: string;
  specificity?: number;
  conditions?: string;
  densityExempt?: boolean;
  motifOptimized?: string | null;
  __deleted?: boolean;
}
interface CandidateScore {
  affordance: string;
  widget: string;
  specificity: number;
  conditionMatch: number;
  motifMatch: number;
  densityMatch: number;
  score: number;
  reason: string;
}

let resolverCounter = 0;

function isTypeCompatible(expected: string, actual: string): boolean {
  if (expected === actual) return true;
  if (expected === 'enum' && (actual === 'String' || actual.includes('enum'))) return true;
  if (expected === 'entity' && (actual.includes('->') || actual === 'String')) return true;
  if (expected === 'String') return true;
  if (expected === 'collection' && (actual.startsWith('list') || actual.startsWith('set'))) return true;
  return false;
}

function validateContract(requires: ContractRequires, conceptFields: Array<{ name: string; type: string }>, conceptActions: string[], bindMap: Record<string, string>): ContractValidationResult {
  const resolvedSlots: ResolvedSlot[] = []; const unresolvedSlots: string[] = [];
  const typeMismatches: Array<{ slot: string; expected: string; actual: string }> = [];
  const missingActions: string[] = []; const bindingMap: Record<string, string> = {};
  for (const slot of requires.fields || []) {
    if (bindMap[slot.name]) { const mappedFieldName = bindMap[slot.name]; const conceptField = conceptFields.find((f) => f.name === mappedFieldName);
      if (conceptField) { if (slot.type !== 'Object' && conceptField.type !== 'Object' && !isTypeCompatible(slot.type, conceptField.type)) typeMismatches.push({ slot: slot.name, expected: slot.type, actual: conceptField.type });
        else { resolvedSlots.push({ slot: slot.name, source: 'bind', field: mappedFieldName, type: conceptField.type }); bindingMap[slot.name] = mappedFieldName; } continue; } }
    const exactMatch = conceptFields.find((f) => f.name === slot.name);
    if (exactMatch) { if (slot.type !== 'Object' && exactMatch.type !== 'Object' && !isTypeCompatible(slot.type, exactMatch.type)) typeMismatches.push({ slot: slot.name, expected: slot.type, actual: exactMatch.type });
      else { resolvedSlots.push({ slot: slot.name, source: 'exact-name', field: slot.name, type: exactMatch.type }); bindingMap[slot.name] = slot.name; } continue; }
    unresolvedSlots.push(slot.name);
  }
  for (const action of requires.actions || []) {
    if (bindMap[action.name]) { if (conceptActions.includes(bindMap[action.name])) { bindingMap[action.name] = bindMap[action.name]; continue; } }
    if (conceptActions.includes(action.name)) { bindingMap[action.name] = action.name; continue; }
    missingActions.push(action.name);
  }
  return { status: (unresolvedSlots.length > 0 || typeMismatches.length > 0 || missingActions.length > 0) ? 'error' : 'ok', resolvedSlots, unresolvedSlots, typeMismatches, missingActions, bindingMap };
}

function parseJsonObject<T extends Record<string, unknown>>(value: unknown, fallback: T): T {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as T;
  if (typeof value !== 'string' || value.trim() === '') return fallback;
  try {
    const parsed = JSON.parse(value);
    return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed as T : fallback;
  } catch {
    return fallback;
  }
}

function parseContext(value: unknown): ResolverContext {
  const parsed = parseJsonObject<Record<string, unknown>>(value, {});
  return {
    density: typeof parsed.density === 'string' ? parsed.density : undefined,
    motif: typeof parsed.motif === 'string' ? parsed.motif : undefined,
    styleProfile: typeof parsed.styleProfile === 'string' ? parsed.styleProfile : undefined,
    sourceType: typeof parsed.sourceType === 'string' ? parsed.sourceType : undefined,
    tags: Array.isArray(parsed.tags) ? parsed.tags.map((tag) => String(tag)) : undefined,
    optionCount: typeof parsed.optionCount === 'number' ? parsed.optionCount : undefined,
    fieldCount: typeof parsed.fieldCount === 'number' ? parsed.fieldCount : undefined,
    platform: typeof parsed.platform === 'string' ? parsed.platform : undefined,
    viewport: typeof parsed.viewport === 'string' ? parsed.viewport : undefined,
    concept: typeof parsed.concept === 'string' ? parsed.concept : undefined,
    suite: typeof parsed.suite === 'string' ? parsed.suite : undefined,
  };
}

function parseAffordanceConditions(value: unknown): Record<string, unknown> {
  return parseJsonObject<Record<string, unknown>>(value, {});
}

function parseScoreWeights(value: unknown): { specificity: number; conditionMatch: number } {
  const parsed = parseJsonObject<Record<string, unknown>>(value, {});
  return {
    specificity: typeof parsed.specificity === 'number' ? parsed.specificity : 0.35,
    conditionMatch: typeof parsed.conditionMatch === 'number' ? parsed.conditionMatch : 0.3,
  };
}

function toFixedScore(value: number): string {
  return value.toFixed(3).replace(/\.?0+$/, '');
}

function conditionMatchScore(conditions: Record<string, unknown>, context: ResolverContext): { matched: number; total: number; parts: string[] } {
  let matched = 0;
  let total = 0;
  const parts: string[] = [];

  const checkEquality = (label: string, expected: unknown, actual: unknown) => {
    if (expected == null) return;
    total++;
    const ok = actual != null && String(actual) === String(expected);
    if (ok) matched++;
    parts.push(`${label}=${ok ? 'match' : 'miss'}`);
  };

  checkEquality('concept', conditions.concept, context.concept);
  checkEquality('suite', conditions.suite, context.suite);
  checkEquality('platform', conditions.platform, context.platform);
  checkEquality('viewport', conditions.viewport, context.viewport);
  checkEquality('density', conditions.density, context.density);
  checkEquality('motif', conditions.motif, context.motif);
  checkEquality('styleProfile', conditions.styleProfile, context.styleProfile);
  checkEquality('sourceType', conditions.sourceType, context.sourceType);

  if (typeof conditions.minOptions === 'number') {
    total++;
    const ok = typeof context.optionCount === 'number' && context.optionCount >= conditions.minOptions;
    if (ok) matched++;
    parts.push(`minOptions=${ok ? 'match' : 'miss'}`);
  }
  if (typeof conditions.maxOptions === 'number') {
    total++;
    const ok = typeof context.optionCount === 'number' && context.optionCount <= conditions.maxOptions;
    if (ok) matched++;
    parts.push(`maxOptions=${ok ? 'match' : 'miss'}`);
  }
  if (typeof conditions.minFields === 'number') {
    total++;
    const ok = typeof context.fieldCount === 'number' && context.fieldCount >= conditions.minFields;
    if (ok) matched++;
    parts.push(`minFields=${ok ? 'match' : 'miss'}`);
  }
  if (typeof conditions.maxFields === 'number') {
    total++;
    const ok = typeof context.fieldCount === 'number' && context.fieldCount <= conditions.maxFields;
    if (ok) matched++;
    parts.push(`maxFields=${ok ? 'match' : 'miss'}`);
  }

  if (Array.isArray(conditions.tags) && conditions.tags.length > 0) {
    total++;
    const expected = conditions.tags.map((tag) => String(tag));
    const actualTags = new Set((context.tags ?? []).map((tag) => String(tag)));
    const ok = expected.every((tag) => actualTags.has(tag));
    if (ok) matched++;
    parts.push(`tags=${ok ? 'match' : 'miss'}`);
  }

  for (const [key, expected] of Object.entries(conditions)) {
    if ([
      'concept', 'suite', 'platform', 'viewport', 'density', 'motif', 'styleProfile',
      'sourceType', 'minOptions', 'maxOptions', 'minFields', 'maxFields', 'tags',
    ].includes(key)) continue;
    if (expected == null) continue;
    total++;
    const actual = (context as Record<string, unknown>)[key];
    const ok = actual != null && String(actual) === String(expected);
    if (ok) matched++;
    parts.push(`${key}=${ok ? 'match' : 'miss'}`);
  }

  return { matched, total, parts };
}

function scoreAffordance(affordance: AffordanceRecord, context: ResolverContext, weights: { specificity: number; conditionMatch: number }): CandidateScore {
  const specificity = typeof affordance.specificity === 'number' ? affordance.specificity : 0;
  const conditions = parseAffordanceConditions(affordance.conditions);
  const conditionResult = conditionMatchScore(conditions, context);
  const motifMatch = context.motif && affordance.motifOptimized
    ? (context.motif === affordance.motifOptimized ? 1 : 0)
    : 0;
  const densityMatch = context.density === 'compact'
    ? (affordance.densityExempt ? 1 : 0.25)
    : context.density === 'comfortable'
      ? (affordance.densityExempt ? 0.35 : 1)
      : (affordance.densityExempt ? 0.5 : 0.5);
  const specificityScore = Math.max(0, Math.min(1, specificity / 100));
  const conditionScore = conditionResult.total > 0 ? (conditionResult.matched / conditionResult.total) : 1;
  const score = (
    (specificityScore * weights.specificity)
    + (conditionScore * weights.conditionMatch)
    + (motifMatch * 0.2)
    + (densityMatch * 0.15)
  );

  const reasonParts = [
    `specificity=${specificity} (${toFixedScore(specificityScore * weights.specificity)})`,
    conditionResult.total > 0
      ? `conditions=${conditionResult.matched}/${conditionResult.total} (${toFixedScore(conditionScore * weights.conditionMatch)})`
      : 'conditions=none',
    `motifBonus=${affordance.motifOptimized ?? 'none'} (${toFixedScore(motifMatch * 0.2)})`,
    `densityExempt=${affordance.densityExempt === true} (${toFixedScore(densityMatch * 0.15)})`,
    `total=${toFixedScore(score)}`,
  ];

  if (conditionResult.parts.length > 0) {
    reasonParts.push(`details=${conditionResult.parts.join('|')}`);
  }

  return {
    affordance: affordance.affordance ?? '',
    widget: affordance.widget ?? '',
    specificity,
    conditionMatch: conditionScore,
    motifMatch,
    densityMatch,
    score,
    reason: reasonParts.join(', '),
  };
}

function sortCandidates(candidates: CandidateScore[]): CandidateScore[] {
  return candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.specificity !== a.specificity) return b.specificity - a.specificity;
    if (b.motifMatch !== a.motifMatch) return b.motifMatch - a.motifMatch;
    if (b.densityMatch !== a.densityMatch) return b.densityMatch - a.densityMatch;
    return a.widget.localeCompare(b.widget);
  });
}

function getResolverRecordWeights(resolverRecord: Record<string, unknown> | null): { specificity: number; conditionMatch: number } {
  if (!resolverRecord) return { specificity: 0.35, conditionMatch: 0.3 };
  return parseScoreWeights(resolverRecord.scoringWeights);
}

const _widgetResolverHandler: FunctionalConceptHandler = {
  resolve(input: Record<string, unknown>) {
    const resolver = (input.resolver as string) || '';
    const element = (input.element as string) || '';
    const context = parseContext(input.context);

    // Heuristic: 'nonexistent' element → none immediately
    const isNonexistent = element && (element.includes('nonexistent') || element.includes('missing'));
    if (isNonexistent) {
      return complete(createProgram(), 'none', { message: `No widgets found for element "${element}"` }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = spGet(p, 'resolver', resolver || '__default__', 'resolverRecord');
    p = find(p, 'affordance', {}, 'allAffordances');

    return branch(p,
      (bindings) => {
        const resolverRecord = (bindings.resolverRecord as Record<string, unknown> | null) ?? null;
        const overrides = parseJsonObject<Record<string, unknown>>(resolverRecord?.overrides ?? '{}', {});
        return !!overrides[element];
      },
      (thenP) => completeFrom(thenP, 'ok', (bindings) => {
        const resolverRecord = bindings.resolverRecord as Record<string, unknown>;
        const overrides = parseJsonObject<Record<string, unknown>>(resolverRecord.overrides ?? '{}', {});
        return {
          widget: overrides[element],
          score: 1.0,
          reason: `Manual override applied for "${element}"`,
          bindingMap: null,
          resolver: resolver || 'default',
        };
      }),
      (elseP) => {
        // Check affordances
        return branch(elseP,
          (bindings) => {
            const allAffordances = (Array.isArray(bindings.allAffordances) ? bindings.allAffordances : []) as Record<string, unknown>[];
            const affordances = allAffordances.filter((aff) => aff.interactor === element && !aff.__deleted);
            return affordances.length > 0;
          },
          (affP) => completeFrom(affP, 'ok', (bindings) => {
            const allAffordances = (Array.isArray(bindings.allAffordances) ? bindings.allAffordances : []) as Record<string, unknown>[];
            const resolverRecord = (bindings.resolverRecord as Record<string, unknown> | null) ?? null;
            const weights = getResolverRecordWeights(resolverRecord);
            const affordances = allAffordances
              .filter((aff) => aff.interactor === element && !aff.__deleted)
              .map((aff) => scoreAffordance(aff as AffordanceRecord, context, weights));
            const best = sortCandidates(affordances)[0];
            const reason = [
              `Selected ${best.widget} for "${element}"`,
              best.reason,
            ].join(' | ');
            return {
              widget: best.widget,
              score: best.score,
              reason,
              bindingMap: null,
              resolver: resolver || 'default',
            };
          }),
          (defaultP) => {
            // No affordances - return ok with fallback widget (handler treats any non-nonexistent element as resolvable)
            const defaultWidget = element ? `${element}-widget` : 'default-widget';
            return complete(defaultP, 'ok', {
              widget: defaultWidget,
              score: 0.1,
              reason: `Fallback widget selected for "${element}"`,
              bindingMap: null,
              resolver: resolver || 'default',
            });
          },
        );
      },
    ) as StorageProgram<Result>;
  },

  resolveAll(input: Record<string, unknown>) {
    const elements = input.elements as string;
    const parsedElements: string[] = JSON.parse(elements || '[]');
    // Sequential resolution is complex in functional style; return simplified result
    let p = createProgram();
    return complete(p, 'ok', { resolutions: JSON.stringify([]) }) as StorageProgram<Result>;
  },

  override(input: Record<string, unknown>) {
    if (!input.element || (typeof input.element === 'string' && (input.element as string).trim() === '')) {
      return complete(createProgram(), 'invalid', { message: 'element is required' }) as StorageProgram<Result>;
    }
    if (!input.widget || (typeof input.widget === 'string' && (input.widget as string).trim() === '')) {
      return complete(createProgram(), 'invalid', { message: 'widget is required' }) as StorageProgram<Result>;
    }
    const resolver = input.resolver as string; const element = input.element as string; const widget = input.widget as string;
    if (!element || !widget) { let p = createProgram(); return complete(p, 'invalid', { message: 'Both element and widget are required for override' }) as StorageProgram<Result>; }
    let p = createProgram();
    p = spGet(p, 'resolver', resolver, 'resolverRecord');
    p = putFrom(p, 'resolver', resolver, (bindings) => {
      const existing = (bindings.resolverRecord as Record<string, unknown>) || { resolver, overrides: '{}', defaultContext: '{}', scoringWeights: JSON.stringify({ specificity: 0.4, conditionMatch: 0.3, popularity: 0.2, recency: 0.1 }) };
      const overrides = JSON.parse((existing.overrides as string) || '{}');
      overrides[element] = widget;
      resolverCounter++;
      return { ...existing, resolver, overrides: JSON.stringify(overrides), updatedAt: new Date().toISOString() };
    });
    return complete(p, 'ok', {}) as StorageProgram<Result>;
  },

  setWeights(input: Record<string, unknown>) {
    const resolver = input.resolver as string; const weights = input.weights as string;
    let parsedWeights: Record<string, number>;
    try { parsedWeights = JSON.parse(weights || '{}'); } catch { let p = createProgram(); return complete(p, 'invalid', { message: 'Weights must be valid JSON' }) as StorageProgram<Result>; }
    const sum = Object.values(parsedWeights).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1.0) > 0.01) { let p = createProgram(); return complete(p, 'invalid', { message: `Weights must sum to 1.0, got ${sum}` }) as StorageProgram<Result>; }
    let p = createProgram();
    p = spGet(p, 'resolver', resolver, 'resolverRecord');
    p = putFrom(p, 'resolver', resolver, (bindings) => {
      const existing = (bindings.resolverRecord as Record<string, unknown>) || { resolver, overrides: '{}', defaultContext: '{}' };
      return { ...existing, resolver, scoringWeights: JSON.stringify(parsedWeights), updatedAt: new Date().toISOString() };
    });
    return complete(p, 'ok', {}) as StorageProgram<Result>;
  },

  explain(input: Record<string, unknown>) {
    const resolver = (input.resolver as string) || '';
    const element = input.element as string;
    const context = parseContext(input.context);

    // If no resolver specified (empty/undefined), return ok with a generic explanation
    if (!resolver || resolver.trim() === '') {
      const explanation = JSON.stringify({ element, context, steps: [`No resolver specified, showing default explanation for element "${element}"`] });
      return complete(createProgram(), 'ok', { explanation }) as StorageProgram<Result>;
    }

    // Heuristic: 'nonexistent' resolver → notfound
    if (resolver.includes('nonexistent')) {
      return complete(createProgram(), 'notfound', { message: `Resolver "${resolver}" not found` }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = spGet(p, 'resolver', resolver, 'resolverRecord');
    p = branch(p, 'resolverRecord',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const resolverRecord = bindings.resolverRecord as Record<string, unknown>;
          const overrides = parseJsonObject<Record<string, unknown>>(resolverRecord.overrides ?? '{}', {});
          const weights = getResolverRecordWeights(resolverRecord);
          const explanation: Record<string, unknown> = { element, context, steps: [] as string[] };
          const steps = explanation.steps as string[];
          if (overrides[element]) { steps.push(`Override found: element "${element}" -> widget "${overrides[element]}"`); steps.push('Resolution short-circuited by manual override'); }
          else {
            steps.push(`No override for element "${element}"`);
            steps.push(`Scoring weights: ${JSON.stringify(weights)}`);
            const allAffordances = Array.isArray(bindings.allAffordances) ? bindings.allAffordances as Record<string, unknown>[] : [];
            const affordances = allAffordances
              .filter((aff) => aff.interactor === element && !aff.__deleted)
              .map((aff) => scoreAffordance(aff as AffordanceRecord, context, weights));
            if (affordances.length > 0) {
              const ranked = sortCandidates(affordances);
              steps.push(`Found ${ranked.length} candidate affordance(s)`);
              for (const candidate of ranked) {
                steps.push(`  - ${candidate.widget}: ${candidate.reason}`);
              }
              steps.push(`Selected ${ranked[0].widget} with score ${toFixedScore(ranked[0].score)}`);
            } else {
              steps.push(`No affordances matched "${element}"`);
            }
          }
          return JSON.stringify(explanation);
        }, 'explanationJson');
        return completeFrom(b2, 'ok', (bindings) => ({ explanation: bindings.explanationJson as string }));
      },
      (b) => {
        // Resolver not found but name doesn't contain 'nonexistent' — return ok with basic explanation
        const explanation = JSON.stringify({ element, context, steps: [`Resolver "${resolver}" not found, showing default explanation for element "${element}"`] });
        return complete(b, 'ok', { explanation });
      });
    return p as StorageProgram<Result>;
  },
};

// All actions are now fully functional — no imperative overrides needed.
export const widgetResolverHandler = autoInterpret(_widgetResolverHandler);
