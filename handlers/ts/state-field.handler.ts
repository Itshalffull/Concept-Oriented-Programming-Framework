// ============================================================
// StateField Handler
//
// Single state declaration in a concept, traced through code
// generation and storage mapping. Enables impact analysis --
// "if I change this field's type, what generated code and storage
// schemas are affected?"
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `state-field-${++idCounter}`;
}

/**
 * Infer cardinality from a type expression string.
 * Recognized patterns: "set X", "X -> Y" (mapping), "list X",
 * "option X" / "X?", otherwise "scalar".
 */
function inferCardinality(typeExpr: string): string {
  const t = typeExpr.trim().toLowerCase();
  if (t.startsWith('set ')) return 'set';
  if (t.includes('->')) return 'mapping';
  if (t.startsWith('list ')) return 'list';
  if (t.startsWith('option ') || t.endsWith('?')) return 'option';
  return 'scalar';
}

export const stateFieldHandler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    const concept = input.concept as string;
    const name = input.name as string;
    const typeExpr = input.typeExpr as string;

    const id = nextId();
    const symbol = `clef/field/${concept}/${name}`;
    const cardinality = inferCardinality(typeExpr);

    await storage.put('state-field', id, {
      id,
      concept,
      name,
      symbol,
      typeExpr,
      cardinality,
      group: '',
      generatedSymbols: '[]',
    });

    return { variant: 'ok', field: id };
  },

  async findByConcept(input: Record<string, unknown>, storage: ConceptStorage) {
    const concept = input.concept as string;

    const results = await storage.find('state-field', { concept });

    return { variant: 'ok', fields: JSON.stringify(results) };
  },

  async traceToGenerated(input: Record<string, unknown>, storage: ConceptStorage) {
    const field = input.field as string;

    const record = await storage.get('state-field', field);
    if (!record) {
      return { variant: 'ok', targets: '[]' };
    }

    // Look up generated symbols referencing this field's symbol
    const generated = await storage.find('provenance', { sourceSymbol: record.symbol });
    const targets = generated.map((g) => ({
      language: g.language || 'typescript',
      symbol: g.targetSymbol || g.symbol,
      file: g.file || g.targetFile,
    }));

    return { variant: 'ok', targets: JSON.stringify(targets) };
  },

  async traceToStorage(input: Record<string, unknown>, storage: ConceptStorage) {
    const field = input.field as string;

    const record = await storage.get('state-field', field);
    if (!record) {
      return { variant: 'ok', targets: '[]' };
    }

    // Look up storage mappings for this field
    const mappings = await storage.find('storage-mapping', { fieldSymbol: record.symbol });
    const targets = mappings.map((m) => ({
      adapter: m.adapter || 'default',
      columnOrKey: m.columnOrKey || m.column || record.name,
    }));

    return { variant: 'ok', targets: JSON.stringify(targets) };
  },

  async get(input: Record<string, unknown>, storage: ConceptStorage) {
    const field = input.field as string;

    const record = await storage.get('state-field', field);
    if (!record) {
      return { variant: 'notfound' };
    }

    return {
      variant: 'ok',
      field: record.id as string,
      concept: record.concept as string,
      name: record.name as string,
      typeExpr: record.typeExpr as string,
      cardinality: record.cardinality as string,
    };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetStateFieldCounter(): void {
  idCounter = 0;
}
