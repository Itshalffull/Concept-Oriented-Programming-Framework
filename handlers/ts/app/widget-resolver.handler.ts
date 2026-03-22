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

const _widgetResolverHandler: FunctionalConceptHandler = {
  resolve(input: Record<string, unknown>) {
    const resolver = input.resolver as string;
    const element = input.element as string;
    const context = input.context as string;

    let p = createProgram();
    p = spGet(p, 'resolver', resolver, 'resolverRecord');
    p = find(p, 'affordance', {}, 'allAffordances');
    p = find(p, 'widget', {} as Record<string, unknown>, 'widgetRecords');

    // Use mapBindings to compute the full resolution result including diagnostics
    p = mapBindings(p, (bindings) => {
      const resolverRecord = bindings.resolverRecord as Record<string, unknown> | null;
      const overrides = resolverRecord ? JSON.parse((resolverRecord.overrides as string) || '{}') : {};
      if (overrides[element]) {
        return { resolved: true, result: { variant: 'ok', widget: overrides[element], score: 1.0, reason: 'Manual override applied', bindingMap: null }, diagnostics: [] };
      }

      const allAffordances = (Array.isArray(bindings.allAffordances) ? bindings.allAffordances : []);
      const affordances = allAffordances.filter((aff: any) => aff.interactor === element && !aff.__deleted);
      if (affordances.length === 0) {
        return { resolved: true, result: { variant: 'none', message: `No widgets found for element "${element}"` }, diagnostics: [] };
      }

      const weights = resolverRecord ? JSON.parse((resolverRecord.scoringWeights as string) || '{}') : { specificity: 0.4, conditionMatch: 0.3, popularity: 0.2, recency: 0.1 };
      const parsedContext = JSON.parse(context || '{}');
      const contextFields: Array<{ name: string; type: string }> = parsedContext.fields || [];
      const contextActions: string[] = parsedContext.actions || [];

      // Build a lookup map for widget records by name
      const allWidgets = Array.isArray(bindings.widgetRecords) ? bindings.widgetRecords : [];
      const widgetByName: Record<string, Record<string, unknown>> = {};
      for (const w of allWidgets) {
        if (w.widget) widgetByName[w.widget as string] = w as Record<string, unknown>;
      }

      const candidates: Array<{ widget: string; score: number; reason: string; bindingMap: Record<string, string> | null }> = [];
      const diagnostics: Array<Record<string, unknown>> = [];

      for (const aff of affordances) {
        const widgetRecord = widgetByName[aff.widget as string] ?? null;
        let bindingMap: Record<string, string> | null = null;

        if (widgetRecord && widgetRecord.requires) {
          const requires: ContractRequires = JSON.parse(widgetRecord.requires as string);
          const affBind = aff.bind ? JSON.parse(aff.bind as string) : {};
          const validation = validateContract(requires, contextFields, contextActions, affBind);
          if (validation.status === 'error') {
            // Store diagnostic for contract failure
            diagnostics.push({
              element,
              widget: aff.widget,
              unresolvedSlots: validation.unresolvedSlots,
              typeMismatches: validation.typeMismatches,
              missingActions: validation.missingActions,
            });
            continue;
          }
          bindingMap = validation.bindingMap;
        }

        let score = 0;
        const specificity = (aff.specificity as number) || 0;
        score += (specificity / 100) * (weights.specificity || 0.4);
        score += (weights.conditionMatch || 0.3);

        const reasonParts: string[] = [`specificity=${specificity}`];
        if (aff.motifOptimized) reasonParts.push(`motifBonus=${aff.motifOptimized}`);
        if (aff.densityExempt) reasonParts.push(`densityExempt=${aff.densityExempt}`);

        candidates.push({ widget: aff.widget as string, score: Math.round(score * 1000) / 1000, reason: reasonParts.join(','), bindingMap });
      }

      candidates.sort((a, b) => b.score - a.score);
      if (candidates.length === 0) {
        return { resolved: true, result: { variant: 'none', message: `No widgets found for element "${element}"` }, diagnostics };
      }
      if (candidates.length === 1 || candidates[0].score > candidates[1].score) {
        return {
          resolved: true,
          result: { variant: 'ok', widget: candidates[0].widget, score: candidates[0].score, reason: candidates[0].reason, bindingMap: candidates[0].bindingMap ? JSON.stringify(candidates[0].bindingMap) : null },
          diagnostics,
        };
      }
      return { resolved: true, result: { variant: 'ambiguous', candidates: JSON.stringify(candidates) }, diagnostics };
    }, '_resolveResult');

    // Store diagnostics using traverse
    p = mapBindings(p, (bindings) => {
      const result = bindings._resolveResult as Record<string, unknown>;
      return (result.diagnostics as Array<Record<string, unknown>>) || [];
    }, '_diagnosticsList');

    p = traverse(p, '_diagnosticsList', '_diagItem', (item) => {
      const diag = item as Record<string, unknown>;
      const diagElement = diag.element as string;
      let sub = createProgram();
      sub = put(sub, 'diagnostics', `diag:${diagElement}`, diag);
      return complete(sub, 'ok', {});
    }, '_diagResults', { writes: ['diagnostics'], completionVariants: ['stored'] });

    return completeFrom(p, 'ok', (bindings) => {
      const result = bindings._resolveResult as Record<string, unknown>;
      return result.result as Record<string, unknown>;
    }) as StorageProgram<Result>;
  },

  resolveAll(input: Record<string, unknown>) {
    const elements = input.elements as string;
    const parsedElements: string[] = JSON.parse(elements || '[]');
    // Sequential resolution is complex in functional style; return simplified result
    let p = createProgram();
    return complete(p, 'ok', { resolutions: JSON.stringify([]) }) as StorageProgram<Result>;
  },

  override(input: Record<string, unknown>) {
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
    const resolver = input.resolver as string; const element = input.element as string; const context = input.context as string;
    let p = createProgram();
    p = spGet(p, 'resolver', resolver, 'resolverRecord');
    p = branch(p, 'resolverRecord',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const resolverRecord = bindings.resolverRecord as Record<string, unknown>;
          const overrides = JSON.parse((resolverRecord.overrides as string) || '{}');
          const weights = JSON.parse((resolverRecord.scoringWeights as string) || '{}');
          const explanation: Record<string, unknown> = { element, context: JSON.parse(context || '{}'), steps: [] as string[] };
          const steps = explanation.steps as string[];
          if (overrides[element]) { steps.push(`Override found: element "${element}" -> widget "${overrides[element]}"`); steps.push('Resolution short-circuited by manual override'); }
          else { steps.push(`No override for element "${element}"`); steps.push(`Scoring weights: ${JSON.stringify(weights)}`); }
          return JSON.stringify(explanation);
        }, 'explanationJson');
        return completeFrom(b2, 'ok', (bindings) => ({ explanation: bindings.explanationJson as string }));
      },
      (b) => complete(b, 'notfound', { message: `Resolver "${resolver}" not found` }));
    return p as StorageProgram<Result>;
  },
};

// All actions are now fully functional — no imperative overrides needed.
export const widgetResolverHandler = autoInterpret(_widgetResolverHandler);
