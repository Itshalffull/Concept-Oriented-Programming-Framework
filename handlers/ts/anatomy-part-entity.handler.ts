// ============================================================
// AnatomyPartEntity Handler
//
// Named part within a widget's anatomy -- each carries a semantic role
// and connects to props via the connect section. Enables tracing
// from rendered UI elements back to concept state fields and
// actions.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `anatomy-part-entity-${++idCounter}`;
}

export const anatomyPartEntityHandler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    const widget = input.widget as string;
    const name = input.name as string;
    const role = input.role as string;
    const required = input.required as string;

    const id = nextId();
    const symbol = `clef/anatomy/${widget}/${name}`;

    await storage.put('anatomy-part-entity', id, {
      id,
      widget,
      name,
      symbol,
      semanticRole: role,
      required,
      description: '',
      connectProps: '[]',
      ariaAttrs: '[]',
      boundField: '',
      boundAction: '',
    });

    return { variant: 'ok', part: id };
  },

  async findByRole(input: Record<string, unknown>, storage: ConceptStorage) {
    const role = input.role as string;

    const results = await storage.find('anatomy-part-entity', { semanticRole: role });

    return { variant: 'ok', parts: JSON.stringify(results) };
  },

  async findBoundToField(input: Record<string, unknown>, storage: ConceptStorage) {
    const field = input.field as string;

    const results = await storage.find('anatomy-part-entity', { boundField: field });

    return { variant: 'ok', parts: JSON.stringify(results) };
  },

  async findBoundToAction(input: Record<string, unknown>, storage: ConceptStorage) {
    const action = input.action as string;

    const results = await storage.find('anatomy-part-entity', { boundAction: action });

    return { variant: 'ok', parts: JSON.stringify(results) };
  },

  async get(input: Record<string, unknown>, storage: ConceptStorage) {
    const part = input.part as string;

    const record = await storage.get('anatomy-part-entity', part);
    if (!record) {
      return { variant: 'notfound' };
    }

    return {
      variant: 'ok',
      part: record.id as string,
      widget: record.widget as string,
      name: record.name as string,
      semanticRole: record.semanticRole as string,
      required: record.required as string,
    };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetAnatomyPartEntityCounter(): void {
  idCounter = 0;
}
