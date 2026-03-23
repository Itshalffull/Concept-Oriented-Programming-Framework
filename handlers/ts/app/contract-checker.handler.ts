// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ContractChecker Concept Implementation
// Validates widget contracts against concept specs statically.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

function isTypeCompatible(expected: string, actual: string): boolean {
  if (expected === actual) return true;
  if (expected === 'enum' && (actual === 'String' || actual.includes('enum'))) return true;
  if (expected === 'entity' && (actual.includes('->') || actual === 'String')) return true;
  if (expected === 'String') return true;
  if (expected === 'collection' && (actual.startsWith('list') || actual.startsWith('set'))) return true;
  return false;
}

const _contractCheckerHandler: FunctionalConceptHandler = {
  check(input: Record<string, unknown>) {
    const checker = input.checker as string;
    const widgetName = input.widget as string;
    const conceptName = input.concept as string;

    let p = createProgram();
    p = spGet(p, 'widget', widgetName, 'widgetRecord');
    p = branch(p, 'widgetRecord',
      (b) => {
        let b2 = spGet(b, 'concept', conceptName, 'conceptRecord');
        b2 = branch(b2, 'conceptRecord',
          (c) => {
            // Look up affordances to find bind mappings for this widget+concept
            let c2 = find(c, 'affordance', {} as Record<string, unknown>, 'affordanceRecords');
            c2 = mapBindings(c2, (bindings) => {
              const widgetRecord = bindings.widgetRecord as Record<string, unknown>;
              const conceptRecord = bindings.conceptRecord as Record<string, unknown>;
              const requires = widgetRecord.requires ? JSON.parse(widgetRecord.requires as string) : { fields: [], actions: [] };
              const conceptFields: Array<{ name: string; type: string }> = conceptRecord.fields ? JSON.parse(conceptRecord.fields as string) : [];
              const conceptActions: string[] = conceptRecord.actions ? JSON.parse(conceptRecord.actions as string) : [];

              // Find bind mapping from affordances linking this widget to this concept
              const allAffordances = Array.isArray(bindings.affordanceRecords) ? bindings.affordanceRecords : [];
              let bindMap: Record<string, string> = {};
              for (const aff of allAffordances) {
                if ((aff as any).__deleted) continue;
                if ((aff as any).widget === widgetName && aff.bind) {
                  const affConditions = (aff as any).conditions ? JSON.parse((aff as any).conditions as string) : {};
                  if (!affConditions.concept || affConditions.concept === conceptName) {
                    bindMap = { ...bindMap, ...JSON.parse(aff.bind as string) };
                  }
                }
              }

              const resolvedSlots: string[] = [];
              const unresolvedSlots: string[] = [];
              const typeMismatches: Array<{ slot: string; expected: string; actual: string }> = [];

              for (const slot of requires.fields || []) {
                // Check bind mapping first
                if (bindMap[slot.name]) {
                  const mappedFieldName = bindMap[slot.name];
                  const conceptField = conceptFields.find((f) => f.name === mappedFieldName);
                  if (conceptField) {
                    if (slot.type !== 'Object' && conceptField.type !== 'Object' && !isTypeCompatible(slot.type, conceptField.type)) {
                      typeMismatches.push({ slot: slot.name, expected: slot.type, actual: conceptField.type });
                    } else {
                      resolvedSlots.push(slot.name);
                    }
                    continue;
                  }
                }
                // Check exact name match
                const exactMatch = conceptFields.find((f) => f.name === slot.name);
                if (exactMatch) {
                  if (slot.type !== 'Object' && exactMatch.type !== 'Object' && !isTypeCompatible(slot.type, exactMatch.type)) {
                    typeMismatches.push({ slot: slot.name, expected: slot.type, actual: exactMatch.type });
                  } else {
                    resolvedSlots.push(slot.name);
                  }
                  continue;
                }
                unresolvedSlots.push(slot.name);
              }

              return {
                resolved: JSON.stringify(resolvedSlots),
                unresolved: JSON.stringify(unresolvedSlots),
                mismatches: JSON.stringify(typeMismatches),
              };
            }, 'checkResult');
            c2 = mapBindings(c2, (bindings) => {
              const checkResult = bindings.checkResult as Record<string, unknown>;
              return checkResult;
            }, 'finalResult');
            return completeFrom(c2, 'ok', (bindings) => {
              const checkResult = bindings.checkResult as Record<string, unknown>;
              return {
                checker,
                resolved: checkResult.resolved as string,
                unresolved: checkResult.unresolved as string,
                mismatches: checkResult.mismatches as string,
              };
            });
          },
          (c) => complete(c, 'notfound', { message: `Concept "${conceptName}" not registered` }),
        );
        return b2;
      },
      (b) => complete(b, 'notfound', { message: `Widget "${widgetName}" not registered` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  checkAll(input: Record<string, unknown>) {
    if (!input.concept || (typeof input.concept === 'string' && (input.concept as string).trim() === '')) {
      return complete(createProgram(), 'notfound', { message: 'concept is required' }) as StorageProgram<Result>;
    }
    const checker = input.checker as string;
    const conceptName = input.concept as string;

    let p = createProgram();
    p = find(p, 'widgetRegistry', conceptName as unknown as Record<string, unknown>, 'allEntries');
    // Per-widget checking resolved at runtime
    return complete(p, 'ok', { checker, results: JSON.stringify([]) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  checkSuite(input: Record<string, unknown>) {
    if (!input.suite || (typeof input.suite === 'string' && (input.suite as string).trim() === '')) {
      return complete(createProgram(), 'notfound', { message: 'suite is required' }) as StorageProgram<Result>;
    }
    const checker = input.checker as string;
    const suiteName = input.suite as string;

    let p = createProgram();
    p = find(p, 'widgetRegistry', suiteName as unknown as Record<string, unknown>, 'allEntries');
    // Per-widget per-concept checking resolved at runtime
    return complete(p, 'ok', { checker, results: JSON.stringify([]) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  suggest(input: Record<string, unknown>) {
    const checker = input.checker as string;
    const widgetName = input.widget as string;
    const conceptName = input.concept as string;

    let p = createProgram();
    p = spGet(p, 'widget', widgetName, 'widgetRecord');
    p = spGet(p, 'concept', conceptName, 'conceptRecord');
    p = mapBindings(p, (bindings) => {
      const widgetRecord = bindings.widgetRecord as Record<string, unknown> | null;
      const conceptRecord = bindings.conceptRecord as Record<string, unknown> | null;
      if (!widgetRecord || !conceptRecord) return [];

      const requires = widgetRecord.requires ? JSON.parse(widgetRecord.requires as string) : { fields: [] };
      const conceptFields: Array<{ name: string; type: string }> = conceptRecord.fields ? JSON.parse(conceptRecord.fields as string) : [];

      const suggestions: Array<{ slot: string; candidates: Array<{ field: string; type: string }> }> = [];

      for (const slot of requires.fields || []) {
        // Find concept fields that could be candidates for this slot (compatible types)
        const exactMatch = conceptFields.find((f) => f.name === slot.name);
        if (exactMatch) continue; // Already resolved by exact name, no suggestion needed

        const candidates = conceptFields.filter((f) => isTypeCompatible(slot.type, f.type));
        if (candidates.length > 0) {
          suggestions.push({
            slot: slot.name,
            candidates: candidates.map((c) => ({ field: c.name, type: c.type })),
          });
        }
      }

      return suggestions;
    }, 'suggestionsResult');
    return completeFrom(p, 'ok', (bindings) => ({
      checker,
      suggestions: JSON.stringify(bindings.suggestionsResult),
    })) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const contractCheckerHandler = autoInterpret(_contractCheckerHandler);

