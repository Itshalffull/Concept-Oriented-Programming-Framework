// ContractChecker Concept Implementation
// Validates widget contracts against concept specs statically.
import type { ConceptHandler } from '@clef/runtime';

export const contractCheckerHandler: ConceptHandler = {
  async check(input, storage) {
    const checker = input.checker as string;
    const widgetName = input.widget as string;
    const conceptName = input.concept as string;
    const suiteName = input.suite as string | undefined;
    const contractVersion = input.contractVersion as number | undefined;

    const widgetRecord = await storage.get('widget', widgetName);
    if (!widgetRecord) {
      return { variant: 'notfound', message: `Widget "${widgetName}" not registered` };
    }

    const requires = widgetRecord.requires ? JSON.parse(widgetRecord.requires as string) : null;
    if (!requires) {
      return {
        variant: 'ok',
        checker,
        resolved: JSON.stringify([]),
        unresolved: JSON.stringify([]),
        mismatches: JSON.stringify([]),
      };
    }

    const conceptRecord = await storage.get('concept', conceptName);
    if (!conceptRecord) {
      return { variant: 'notfound', message: `Concept "${conceptName}" not registered` };
    }

    const conceptFields: Array<{ name: string; type: string }> = conceptRecord.fields
      ? JSON.parse(conceptRecord.fields as string)
      : [];

    const affordanceResults = await storage.find('affordance', 'entity-detail');
    const allAffordances = Array.isArray(affordanceResults) ? affordanceResults : [];
    const matchingAffordance = allAffordances
      .filter((aff) => !aff.__deleted && aff.widget === widgetName && (!aff.interactor || aff.interactor === 'entity-detail'))
      .map((aff) => {
        let conditions: Record<string, unknown> = {};
        try {
          conditions = JSON.parse((aff.conditions as string) || '{}');
        } catch {
          conditions = {};
        }
        return { aff, conditions };
      })
      .filter(({ conditions }) => {
        const conditionConcept = typeof conditions.concept === 'string' ? conditions.concept : null;
        const conditionSuite = typeof conditions.suite === 'string' ? conditions.suite : null;
        if (conditionConcept && conditionConcept !== conceptName) return false;
        if (conditionSuite && (!suiteName || conditionSuite !== suiteName)) return false;
        return true;
      })
      .sort((a, b) => {
        const aConcept = a.conditions.concept === conceptName ? 1 : 0;
        const bConcept = b.conditions.concept === conceptName ? 1 : 0;
        if (aConcept !== bConcept) return bConcept - aConcept;
        return ((b.aff.specificity as number) || 0) - ((a.aff.specificity as number) || 0);
      })[0]?.aff;

    const bindMap: Record<string, string> = matchingAffordance?.bind
      ? JSON.parse(matchingAffordance.bind as string)
      : {};

    const resolved: Array<{ slot: string; source: string; field: string; type: string }> = [];
    const unresolved: string[] = [];
    const mismatches: Array<{ slot: string; expected: string; actual: string }> = [];

    for (const slot of requires.fields || []) {
      if (bindMap[slot.name]) {
        const field = conceptFields.find((entry) => entry.name === bindMap[slot.name]);
        if (field) {
          if (!isTypeCompatible(slot.type, field.type)) {
            mismatches.push({ slot: slot.name, expected: slot.type, actual: field.type });
          } else {
            resolved.push({ slot: slot.name, source: 'bind', field: field.name, type: field.type });
          }
          continue;
        }
      }

      const exact = conceptFields.find((entry) => entry.name === slot.name);
      if (exact) {
        if (!isTypeCompatible(slot.type, exact.type)) {
          mismatches.push({ slot: slot.name, expected: slot.type, actual: exact.type });
        } else {
          resolved.push({ slot: slot.name, source: 'exact-name', field: exact.name, type: exact.type });
        }
        continue;
      }

      unresolved.push(slot.name);
    }

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
    const registryResults = await storage.find('widgetRegistry', conceptName);
    const allEntries = Array.isArray(registryResults) ? registryResults : [];
    const conceptScoped = allEntries.filter((entry) => !entry.__deleted && entry.concept === conceptName);
    const entries = conceptScoped.length > 0 ? conceptScoped : allEntries.filter((entry) => !entry.__deleted);

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

    return { variant: 'ok', checker, results: JSON.stringify(results) };
  },

  async checkSuite(input, storage) {
    const checker = input.checker as string;
    const suiteName = input.suite as string;
    const registryResults = await storage.find('widgetRegistry', suiteName);
    const allEntries = Array.isArray(registryResults) ? registryResults : [];
    const suiteScoped = allEntries.filter((entry) => !entry.__deleted && entry.suite === suiteName);
    const scopedEntries = suiteScoped.length > 0 ? suiteScoped : allEntries.filter((entry) => !entry.__deleted);
    const entries = scopedEntries.filter((entry) => Boolean(entry.concept));

    if (allEntries.length === 0) {
      return { variant: 'notfound', message: `No entity widgets registered for suite "${suiteName}"` };
    }

    const results: Array<Record<string, unknown>> = [];
    for (const entry of entries) {
      const checkResult = await (this as ConceptHandler).check!(
        {
          checker: `${checker}/${entry.widget}`,
          widget: entry.widget as string,
          concept: entry.concept as string,
          suite: suiteName,
        },
        storage,
      );
      results.push({
        widget: entry.widget,
        concept: entry.concept,
        ...checkResult,
      });
    }

    return { variant: 'ok', checker, results: JSON.stringify(results) };
  },

  async suggest(input, storage) {
    const checker = input.checker as string;
    const widgetName = input.widget as string;
    const conceptName = input.concept as string;
    const checkResult = await (this as ConceptHandler).check!({ checker, widget: widgetName, concept: conceptName }, storage);

    if (checkResult.variant === 'notfound') {
      return checkResult;
    }

    const unresolved: string[] = JSON.parse((checkResult.unresolved as string) || '[]');
    if (unresolved.length === 0) {
      return { variant: 'resolved', message: 'All slots already resolved, no suggestions needed' };
    }

    const widgetRecord = await storage.get('widget', widgetName);
    const requires = widgetRecord?.requires ? JSON.parse(widgetRecord.requires as string) : { fields: [] };
    const conceptRecord = await storage.get('concept', conceptName);
    const conceptFields: Array<{ name: string; type: string }> = conceptRecord?.fields
      ? JSON.parse(conceptRecord.fields as string)
      : [];

    const suggestions = unresolved.flatMap((slotName) => {
      const contractSlot = (requires.fields || []).find((field: { name: string; type: string }) => field.name === slotName);
      if (!contractSlot) return [];
      return [{
        slot: slotName,
        candidates: conceptFields
          .filter((field) => isTypeCompatible(contractSlot.type, field.type))
          .map((field) => ({ field: field.name, type: field.type })),
      }];
    });

    return { variant: 'ok', checker, suggestions: JSON.stringify(suggestions) };
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
