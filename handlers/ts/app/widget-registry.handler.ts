// WidgetRegistry Concept Implementation
// Queryable index of all registered entity-level affordances.
// Populated from parsed .widget files, queried by concept, suite, or interactor type.
import type { ConceptHandler } from '@clef/runtime';

export const widgetRegistryHandler: ConceptHandler = {
  async register(input, storage) {
    const entry = input.entry as string;
    const widget = input.widget as string;
    const interactor = input.interactor as string;
    const concept = input.concept as string | null;
    const suite = input.suite as string | null;
    const tags = input.tags as string;
    const specificity = input.specificity as number;
    const contractVersion = input.contractVersion as number;
    const contractSlots = input.contractSlots as string;
    const contractActions = input.contractActions as string;
    const secondaryRoles = input.secondaryRoles as string;

    const existing = await storage.get('widgetRegistry', entry);
    if (existing) {
      return { variant: 'duplicate', message: `Entry "${entry}" already registered` };
    }

    await storage.put('widgetRegistry', entry, {
      entry,
      widget,
      interactor,
      concept: concept || null,
      suite: suite || null,
      tags: tags || '[]',
      specificity,
      contractVersion: contractVersion || 1,
      contractSlots: contractSlots || '[]',
      contractActions: contractActions || '[]',
      secondaryRoles: secondaryRoles || '[]',
      registeredAt: new Date().toISOString(),
    });

    return { variant: 'ok', entry };
  },

  async query(input, storage) {
    const concept = input.concept as string | null;
    const suite = input.suite as string | null;
    const interactor = input.interactor as string | null;

    // Query by the most specific filter available
    const queryKey = concept || suite || interactor || '';
    const results = await storage.find('widgetRegistry', queryKey);
    const allEntries = Array.isArray(results) ? results : [];

    // Apply filters
    const filtered = allEntries.filter((entry) => {
      if (concept && entry.concept !== concept) return false;
      if (suite && entry.suite !== suite) return false;
      if (interactor && entry.interactor !== interactor) return false;
      return true;
    });

    if (filtered.length === 0) {
      return { variant: 'none', message: 'No matching entity affordances found' };
    }

    // Sort by specificity descending
    filtered.sort((a, b) => (b.specificity as number) - (a.specificity as number));

    const entries = filtered.map((e) => ({
      entry: e.entry,
      widget: e.widget,
      interactor: e.interactor,
      concept: e.concept,
      suite: e.suite,
      specificity: e.specificity,
      contractVersion: e.contractVersion,
      contractSlots: e.contractSlots,
      contractActions: e.contractActions,
      secondaryRoles: e.secondaryRoles,
    }));

    return { variant: 'ok', entries: JSON.stringify(entries) };
  },

  async remove(input, storage) {
    const entry = input.entry as string;

    const existing = await storage.get('widgetRegistry', entry);
    if (!existing) {
      return { variant: 'notfound', message: `Entry "${entry}" not found` };
    }

    await storage.put('widgetRegistry', entry, { __deleted: true });

    return { variant: 'ok', entry };
  },
};
