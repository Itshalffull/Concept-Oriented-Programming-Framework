// ContractChecker Concept Implementation
// Validates widget contracts against concept specs statically.
// Runs the field resolution algorithm without a live binding and reports
// resolved slots, unresolved slots, type mismatches, and suggestions.
import type { ConceptHandler } from '@clef/runtime';

export const contractCheckerHandler: ConceptHandler = {
  async check(input, storage) {
    const checker = input.checker as string;
    const widgetName = input.widget as string;
    const conceptName = input.concept as string;
    const contractVersion = input.contractVersion as number | undefined;

    // Look up widget and its contract
    const widgetRecord = await storage.get('widget', widgetName);
    if (!widgetRecord) {
      return { variant: 'notfound', message: `Widget "${widgetName}" not registered` };
    }

    const requires = widgetRecord.requires
      ? JSON.parse(widgetRecord.requires as string)
      : null;

    if (!requires) {
      return {
        variant: 'ok',
        checker,
        resolved: JSON.stringify([]),
        unresolved: JSON.stringify([]),
        mismatches: JSON.stringify([]),
      };
    }

    // Look up concept spec
    const conceptRecord = await storage.get('concept', conceptName);
    if (!conceptRecord) {
      return { variant: 'notfound', message: `Concept "${conceptName}" not registered` };
    }

    const conceptFields: Array<{ name: string; type: string }> = conceptRecord.fields
      ? JSON.parse(conceptRecord.fields as string)
      : [];
    const conceptActions: string[] = conceptRecord.actions
      ? JSON.parse(conceptRecord.actions as string)
      : [];

    // Find the affordance bind map for this concept+widget pair
    const affordanceResults = await storage.find('affordance', 'entity-detail');
    const allAffordances = Array.isArray(affordanceResults) ? affordanceResults : [];
    const matchingAffordance = allAffordances.find(
      (aff) => aff.widget === widgetName,
    );
    const bindMap: Record<string, string> = matchingAffordance?.bind
      ? JSON.parse(matchingAffordance.bind as string)
      : {};

    // Run field resolution
    const contractFields = requires.fields || [];
    const resolved: Array<{ slot: string; source: string; field: string; type: string }> = [];
    const unresolved: string[] = [];
    const mismatches: Array<{ slot: string; expected: string; actual: string }> = [];

    for (const slot of contractFields) {
      // Strategy 1: Explicit bind
      if (bindMap[slot.name]) {
        const field = conceptFields.find((f) => f.name === bindMap[slot.name]);
        if (field) {
          resolved.push({ slot: slot.name, source: 'bind', field: field.name, type: field.type });
          continue;
        }
      }

      // Strategy 2: Exact name match
      const exact = conceptFields.find((f) => f.name === slot.name);
      if (exact) {
        resolved.push({ slot: slot.name, source: 'exact-name', field: exact.name, type: exact.type });
        continue;
      }

      unresolved.push(slot.name);
    }

    // Store result
    await storage.put('contractCheck', checker, {
      widget: widgetName,
      concept: conceptName,
      contractVersion: contractVersion ?? requires.version ?? 1,
      status: unresolved.length > 0 || mismatches.length > 0 ? 'error' : 'ok',
      resolvedSlots: JSON.stringify(resolved),
      unresolvedSlots: JSON.stringify(unresolved),
      typeMismatches: JSON.stringify(mismatches),
      timestamp: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      checker,
      resolved: JSON.stringify(resolved),
      unresolved: JSON.stringify(unresolved),
      mismatches: JSON.stringify(mismatches),
    };
  },

  async checkAll(input, storage) {
    const checker = input.checker as string;
    const conceptName = input.concept as string;

    // Find all entity affordances for this concept
    const registryResults = await storage.find('widgetRegistry', conceptName);
    const entries = Array.isArray(registryResults) ? registryResults : [];

    if (entries.length === 0) {
      return { variant: 'notfound', message: `No entity widgets registered for concept "${conceptName}"` };
    }

    const results: Array<Record<string, unknown>> = [];
    for (const entry of entries) {
      const checkResult = await (this as ConceptHandler).check!(
        { checker: `${checker}/${entry.widget}`, widget: entry.widget as string, concept: conceptName },
        storage,
      );
      results.push({
        widget: entry.widget,
        interactor: entry.interactor,
        specificity: entry.specificity,
        ...checkResult,
      });
    }

    return {
      variant: 'ok',
      checker,
      results: JSON.stringify(results),
    };
  },

  async checkSuite(input, storage) {
    const checker = input.checker as string;
    const suiteName = input.suite as string;

    const registryResults = await storage.find('widgetRegistry', suiteName);
    const entries = Array.isArray(registryResults) ? registryResults : [];

    if (entries.length === 0) {
      return { variant: 'notfound', message: `No entity widgets registered for suite "${suiteName}"` };
    }

    const results: Array<Record<string, unknown>> = [];
    for (const entry of entries) {
      if (entry.concept) {
        const checkResult = await (this as ConceptHandler).check!(
          { checker: `${checker}/${entry.widget}`, widget: entry.widget as string, concept: entry.concept as string },
          storage,
        );
        results.push({
          widget: entry.widget,
          concept: entry.concept,
          ...checkResult,
        });
      }
    }

    return {
      variant: 'ok',
      checker,
      results: JSON.stringify(results),
    };
  },

  async suggest(input, storage) {
    const checker = input.checker as string;
    const widgetName = input.widget as string;
    const conceptName = input.concept as string;

    // Run check first
    const checkResult = await (this as ConceptHandler).check!(
      { checker, widget: widgetName, concept: conceptName },
      storage,
    );

    if (checkResult.variant === 'notfound') {
      return checkResult;
    }

    const unresolved: string[] = JSON.parse((checkResult.unresolved as string) || '[]');
    if (unresolved.length === 0) {
      return { variant: 'resolved', message: 'All slots already resolved, no suggestions needed' };
    }

    // Look up widget contract to get expected types
    const widgetRecord = await storage.get('widget', widgetName);
    const requires = widgetRecord?.requires
      ? JSON.parse(widgetRecord.requires as string)
      : { fields: [] };

    // Look up concept fields
    const conceptRecord = await storage.get('concept', conceptName);
    const conceptFields: Array<{ name: string; type: string }> = conceptRecord?.fields
      ? JSON.parse(conceptRecord.fields as string)
      : [];

    const suggestions: Array<{ slot: string; candidates: Array<{ field: string; type: string }> }> = [];

    for (const slotName of unresolved) {
      const contractSlot = (requires.fields || []).find(
        (f: { name: string; type: string }) => f.name === slotName,
      );
      if (!contractSlot) continue;

      // Find concept fields with compatible types
      const candidates = conceptFields.filter((f) =>
        isTypeCompatible(contractSlot.type, f.type),
      );

      suggestions.push({
        slot: slotName,
        candidates: candidates.map((c) => ({ field: c.name, type: c.type })),
      });
    }

    return {
      variant: 'ok',
      checker,
      suggestions: JSON.stringify(suggestions),
    };
  },
};

function isTypeCompatible(expected: string, actual: string): boolean {
  if (expected === actual) return true;
  if (expected === 'enum' && (actual === 'String' || actual.includes('enum'))) return true;
  if (expected === 'entity' && (actual.includes('->') || actual === 'String')) return true;
  if (expected === 'String') return true;
  if (expected === 'collection' && (actual.startsWith('list') || actual.startsWith('set'))) return true;
  return false;
}
