// ============================================================
// WidgetPropEntity Handler
//
// A declared prop on a widget -- typed, with default value,
// connected to anatomy parts and ultimately to concept state
// fields via Binding. Enables tracing from concept fields through
// props to rendered anatomy parts.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `widget-prop-entity-${++idCounter}`;
}

export const widgetPropEntityHandler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    const widget = input.widget as string;
    const name = input.name as string;
    const typeExpr = input.typeExpr as string;
    const defaultValue = input.defaultValue as string;

    const id = nextId();
    const symbol = `clef/prop/${widget}/${name}`;

    await storage.put('widget-prop-entity', id, {
      id,
      widget,
      name,
      symbol,
      typeExpr,
      defaultValue,
      connectedParts: '[]',
    });

    return { variant: 'ok', prop: id };
  },

  async findByWidget(input: Record<string, unknown>, storage: ConceptStorage) {
    const widget = input.widget as string;

    const results = await storage.find('widget-prop-entity', { widget });

    return { variant: 'ok', props: JSON.stringify(results) };
  },

  async traceToField(input: Record<string, unknown>, storage: ConceptStorage) {
    const prop = input.prop as string;

    const record = await storage.get('widget-prop-entity', prop);
    if (!record) {
      return { variant: 'noBinding' };
    }

    // Look up bindings that connect this prop to a concept field
    const bindings = await storage.find('binding', { propSymbol: record.symbol });
    if (bindings.length === 0) {
      return { variant: 'noBinding' };
    }

    const binding = bindings[0];
    return {
      variant: 'ok',
      field: (binding.fieldSymbol as string) || (binding.field as string) || '',
      concept: (binding.concept as string) || (binding.conceptName as string) || '',
      viaBinding: (binding.id as string) || (binding.bindingId as string) || '',
    };
  },

  async get(input: Record<string, unknown>, storage: ConceptStorage) {
    const prop = input.prop as string;

    const record = await storage.get('widget-prop-entity', prop);
    if (!record) {
      return { variant: 'notfound' };
    }

    return {
      variant: 'ok',
      prop: record.id as string,
      widget: record.widget as string,
      name: record.name as string,
      typeExpr: record.typeExpr as string,
      defaultValue: record.defaultValue as string,
    };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetWidgetPropEntityCounter(): void {
  idCounter = 0;
}
