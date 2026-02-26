// ============================================================
// InteractorEntity Handler
//
// Queryable representation of a registered interactor type --
// the abstract interaction taxonomy as a traversable node. Enables
// queries like "what fields classify as this interactor?" and "what
// widgets match this interactor in a given context?"
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `interactor-entity-${++idCounter}`;
}

export const interactorEntityHandler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    const name = input.name as string;
    const category = input.category as string;
    const properties = input.properties as string;

    const id = nextId();
    const symbol = `copf/interactor/${name}`;

    await storage.put('interactor-entity', id, {
      id,
      name,
      symbol,
      category,
      properties,
      classificationRules: '[]',
    });

    return { variant: 'ok', entity: id };
  },

  async findByCategory(input: Record<string, unknown>, storage: ConceptStorage) {
    const category = input.category as string;

    const results = await storage.find('interactor-entity', { category });

    return { variant: 'ok', interactors: JSON.stringify(results) };
  },

  async matchingWidgets(input: Record<string, unknown>, storage: ConceptStorage) {
    const interactor = input.interactor as string;
    const context = input.context as string;

    const record = await storage.get('interactor-entity', interactor);
    if (!record) {
      return { variant: 'ok', widgets: '[]' };
    }

    const interactorName = record.name as string;

    // Find all widgets that declare affordance for this interactor
    const allWidgets = await storage.find('widget-entity');
    const matching = allWidgets.filter((w) => {
      try {
        const ast = JSON.parse(w.ast as string || '{}');
        const affordances = ast.affordances || [];
        return affordances.some((a: Record<string, unknown>) => a.interactor === interactorName);
      } catch {
        return false;
      }
    }).map((w) => ({
      widget: w.name,
      affordanceSpecificity: 1,
      conditionsMet: true,
    }));

    return { variant: 'ok', widgets: JSON.stringify(matching) };
  },

  async classifiedFields(input: Record<string, unknown>, storage: ConceptStorage) {
    const interactor = input.interactor as string;

    const record = await storage.get('interactor-entity', interactor);
    if (!record) {
      return { variant: 'ok', fields: '[]' };
    }

    // Parse the interactor properties to determine classification criteria
    let props: Record<string, unknown> = {};
    try {
      props = JSON.parse(record.properties as string || '{}');
    } catch {
      // empty
    }

    // Search state fields that match the interactor's classification
    const allFields = await storage.find('state-field');
    const classified = allFields.filter((f) => {
      // Match based on cardinality/type alignment with interactor properties
      const dataType = props.dataType as string | undefined;
      const cardinality = props.cardinality as string | undefined;
      if (dataType && f.typeExpr && !(f.typeExpr as string).includes(dataType)) return false;
      if (cardinality && f.cardinality !== cardinality) return false;
      return true;
    }).map((f) => ({
      concept: f.concept,
      field: f.name,
      confidence: 1.0,
    }));

    return { variant: 'ok', fields: JSON.stringify(classified) };
  },

  async coverageReport(_input: Record<string, unknown>, storage: ConceptStorage) {
    const allInteractors = await storage.find('interactor-entity');
    const allWidgets = await storage.find('widget-entity');

    const report = allInteractors.map((interactor) => {
      const interactorName = interactor.name as string;

      // Count widgets with matching affordances
      const matchingWidgets = allWidgets.filter((w) => {
        try {
          const ast = JSON.parse(w.ast as string || '{}');
          const affordances = ast.affordances || [];
          return affordances.some((a: Record<string, unknown>) => a.interactor === interactorName);
        } catch {
          return false;
        }
      });

      return {
        interactor: interactorName,
        widgetCount: matchingWidgets.length,
        uncoveredContexts: [] as string[],
      };
    });

    return { variant: 'ok', report: JSON.stringify(report) };
  },

  async get(input: Record<string, unknown>, storage: ConceptStorage) {
    const interactor = input.interactor as string;

    const record = await storage.get('interactor-entity', interactor);
    if (!record) {
      return { variant: 'notfound' };
    }

    return {
      variant: 'ok',
      interactor: record.id as string,
      name: record.name as string,
      category: record.category as string,
      properties: record.properties as string,
    };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetInteractorEntityCounter(): void {
  idCounter = 0;
}
