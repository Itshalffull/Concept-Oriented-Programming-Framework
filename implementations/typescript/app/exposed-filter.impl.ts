// ExposedFilter Concept Implementation
// Expose interactive filter and sort controls to end users,
// allowing them to modify query parameters through the UI.
import type { ConceptHandler } from '@copf/kernel';

export const exposedFilterHandler: ConceptHandler = {
  async expose(input, storage) {
    const filter = input.filter as string;
    const fieldName = input.fieldName as string;
    const operator = input.operator as string;
    const defaultValue = input.defaultValue as string;

    // Existence check: filter must not already be exposed
    const existing = await storage.get('exposedFilter', filter);
    if (existing) {
      return { variant: 'exists', filter };
    }

    await storage.put('exposedFilter', filter, {
      filter,
      fieldName,
      operator,
      defaultValue,
      userInput: defaultValue,
    });

    return { variant: 'ok', filter };
  },

  async collectInput(input, storage) {
    const filter = input.filter as string;
    const value = input.value as string;

    const record = await storage.get('exposedFilter', filter);
    if (!record) {
      return { variant: 'notfound', filter };
    }

    await storage.put('exposedFilter', filter, {
      ...record,
      userInput: value,
    });

    return { variant: 'ok', filter };
  },

  async applyToQuery(input, storage) {
    const filter = input.filter as string;

    const record = await storage.get('exposedFilter', filter);
    if (!record) {
      return { variant: 'notfound', filter };
    }

    const fieldName = record.fieldName as string;
    const operator = record.operator as string;
    const userInput = record.userInput as string;

    // Produce a query modification clause from the current user input and operator
    const queryMod = `${fieldName} ${operator} '${userInput}'`;

    return { variant: 'ok', queryMod };
  },

  async resetToDefaults(input, storage) {
    const filter = input.filter as string;

    const record = await storage.get('exposedFilter', filter);
    if (!record) {
      return { variant: 'notfound', filter };
    }

    // Restore the default value, clearing user input
    await storage.put('exposedFilter', filter, {
      ...record,
      userInput: record.defaultValue as string,
    });

    return { variant: 'ok', filter };
  },
};
