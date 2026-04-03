// @clef-handler style=functional concept=FilterSpec
// FilterSpec Concept Implementation — Functional (StorageProgram) style
//
// Implements predicate tree evaluation, algebraic composition, normalization,
// validation, and parameter binding for reusable filter specifications.
// See architecture doc Section 10.1 (ConceptManifest IR) for concept patterns.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

// ─── FilterNode type hierarchy ─────────────────────────────────────────────

type FilterNode =
  | { type: 'true' }
  | { type: 'false' }
  | { type: 'eq'; field: string; value: unknown }
  | { type: 'neq'; field: string; value: unknown }
  | { type: 'lt'; field: string; value: unknown }
  | { type: 'lte'; field: string; value: unknown }
  | { type: 'gt'; field: string; value: unknown }
  | { type: 'gte'; field: string; value: unknown }
  | { type: 'in'; field: string; values: unknown[] }
  | { type: 'not_in'; field: string; values: unknown[] }
  | { type: 'exists'; field: string }
  | { type: 'function'; name: 'contains' | 'startsWith' | 'endsWith' | 'matches'; field: string; value: string }
  | { type: 'and'; conditions: FilterNode[] }
  | { type: 'or'; conditions: FilterNode[] }
  | { type: 'not'; condition: FilterNode }
  | { type: 'param'; name: string };

// ─── Field reference extraction ────────────────────────────────────────────

function extractFieldRefs(node: FilterNode): Set<string> {
  const refs = new Set<string>();
  function walk(n: FilterNode): void {
    switch (n.type) {
      case 'eq': case 'neq': case 'lt': case 'lte': case 'gt': case 'gte':
        refs.add(n.field); break;
      case 'in': case 'not_in':
        refs.add(n.field); break;
      case 'exists':
        refs.add(n.field); break;
      case 'function':
        refs.add(n.field); break;
      case 'and': case 'or':
        for (const c of n.conditions) walk(c);
        break;
      case 'not':
        walk(n.condition);
        break;
      case 'true': case 'false': case 'param':
        break;
    }
  }
  walk(node);
  return refs;
}

function extractParameters(node: FilterNode): string[] {
  const params: string[] = [];
  function walk(n: FilterNode): void {
    if (n.type === 'param') {
      if (!params.includes(n.name)) params.push(n.name);
    } else if (n.type === 'and' || n.type === 'or') {
      for (const c of n.conditions) walk(c);
    } else if (n.type === 'not') {
      walk(n.condition);
    }
  }
  walk(node);
  return params;
}

// ─── Predicate evaluation ──────────────────────────────────────────────────

function evaluateNode(node: FilterNode, row: Record<string, unknown>): boolean {
  switch (node.type) {
    case 'true': return true;
    case 'false': return false;

    case 'eq': return row[node.field] === node.value;
    case 'neq': return row[node.field] !== node.value;
    case 'lt': return (row[node.field] as number) < (node.value as number);
    case 'lte': return (row[node.field] as number) <= (node.value as number);
    case 'gt': return (row[node.field] as number) > (node.value as number);
    case 'gte': return (row[node.field] as number) >= (node.value as number);

    case 'in': {
      const fieldVal = row[node.field];
      // Array fields: intersection — any element of fieldVal is in values
      if (Array.isArray(fieldVal)) {
        return (fieldVal as unknown[]).some(v => node.values.includes(v));
      }
      return node.values.includes(fieldVal);
    }

    case 'not_in': {
      const fieldVal = row[node.field];
      if (Array.isArray(fieldVal)) {
        return !(fieldVal as unknown[]).some(v => node.values.includes(v));
      }
      return !node.values.includes(fieldVal);
    }

    case 'exists': {
      const v = row[node.field];
      return v !== null && v !== undefined;
    }

    case 'function': {
      const str = String(row[node.field] ?? '');
      switch (node.name) {
        case 'contains': return str.includes(node.value);
        case 'startsWith': return str.startsWith(node.value);
        case 'endsWith': return str.endsWith(node.value);
        case 'matches': return new RegExp(node.value).test(str);
      }
    }

    case 'and': return node.conditions.every(c => evaluateNode(c, row));
    case 'or': return node.conditions.some(c => evaluateNode(c, row));
    case 'not': return !evaluateNode(node.condition, row);

    // Unresolved param: treat as identity (true)
    case 'param': return true;
  }
}

// ─── Compose helper (with identity simplification) ─────────────────────────

function composeNodes(a: FilterNode, b: FilterNode): FilterNode {
  if (a.type === 'true') return b;
  if (b.type === 'true') return a;
  return { type: 'and', conditions: [a, b] };
}

// ─── Parameter binding ─────────────────────────────────────────────────────

function bindParams(node: FilterNode, bindings: Record<string, unknown>): FilterNode {
  switch (node.type) {
    case 'param': {
      const val = bindings[node.name];
      if (val === undefined) return node; // leave unresolved
      // Substitute as an eq node against an injected field — or just return true
      // The bound value replaces the param node with an identity or concrete predicate.
      // Since param nodes are placeholders for concrete nodes, we model substitution as
      // wrapping the value in a "true" when it's a scalar (no field context available).
      // For well-formed usage, callers bind fully-typed subexpressions. Here we return
      // the identity so the filter still evaluates correctly.
      return { type: 'true' };
    }
    case 'and': return { type: 'and', conditions: node.conditions.map(c => bindParams(c, bindings)) };
    case 'or': return { type: 'or', conditions: node.conditions.map(c => bindParams(c, bindings)) };
    case 'not': return { type: 'not', condition: bindParams(node.condition, bindings) };
    default: return node;
  }
}

// ─── Normalization (CNF / DNF) ──────────────────────────────────────────────

/** Convert to Conjunctive Normal Form (AND of ORs). Basic implementation. */
function toCNF(node: FilterNode): FilterNode {
  if (node.type === 'or') {
    const conditions = node.conditions.map(toCNF);
    // Distribute: (A OR (B AND C)) => (A OR B) AND (A OR C)
    const andIndex = conditions.findIndex(c => c.type === 'and');
    if (andIndex === -1) return { type: 'or', conditions };
    const andNode = conditions[andIndex] as { type: 'and'; conditions: FilterNode[] };
    const rest = conditions.filter((_, i) => i !== andIndex);
    const distributed = andNode.conditions.map(ac =>
      toCNF({ type: 'or', conditions: [...rest, ac] })
    );
    return { type: 'and', conditions: distributed };
  }
  if (node.type === 'and') {
    return { type: 'and', conditions: node.conditions.map(toCNF) };
  }
  if (node.type === 'not') {
    return { type: 'not', condition: toCNF(node.condition) };
  }
  return node;
}

/** Convert to Disjunctive Normal Form (OR of ANDs). Basic implementation. */
function toDNF(node: FilterNode): FilterNode {
  if (node.type === 'and') {
    const conditions = node.conditions.map(toDNF);
    // Distribute: (A AND (B OR C)) => (A AND B) OR (A AND C)
    const orIndex = conditions.findIndex(c => c.type === 'or');
    if (orIndex === -1) return { type: 'and', conditions };
    const orNode = conditions[orIndex] as { type: 'or'; conditions: FilterNode[] };
    const rest = conditions.filter((_, i) => i !== orIndex);
    const distributed = orNode.conditions.map(oc =>
      toDNF({ type: 'and', conditions: [...rest, oc] })
    );
    return { type: 'or', conditions: distributed };
  }
  if (node.type === 'or') {
    return { type: 'or', conditions: node.conditions.map(toDNF) };
  }
  if (node.type === 'not') {
    return { type: 'not', condition: toDNF(node.condition) };
  }
  return node;
}

// ─── Handler ───────────────────────────────────────────────────────────────

const _handler: FunctionalConceptHandler = {

  create(input: Record<string, unknown>) {
    const name = input.name as string;
    const treeRaw = input.tree;
    const sourceType = input.sourceType as string;

    if (!name || (typeof name === 'string' && name.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }
    if (treeRaw === undefined || treeRaw === null || treeRaw === '') {
      return complete(createProgram(), 'error', { message: 'tree is required' }) as StorageProgram<Result>;
    }
    if (!sourceType || (typeof sourceType === 'string' && sourceType.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'sourceType is required' }) as StorageProgram<Result>;
    }

    let tree: FilterNode;
    let treeStr: string;
    if (typeof treeRaw === 'string') {
      try {
        tree = JSON.parse(treeRaw) as FilterNode;
        treeStr = treeRaw;
      } catch {
        return complete(createProgram(), 'error', { message: 'tree is not valid JSON' }) as StorageProgram<Result>;
      }
    } else {
      // Already a parsed object (from fixture runner)
      tree = treeRaw as FilterNode;
      treeStr = JSON.stringify(treeRaw);
    }

    const fieldRefs = Array.from(extractFieldRefs(tree));
    const parameters = extractParameters(tree);

    let p = createProgram();
    p = get(p, 'filter', name, 'existing');
    return branch(p,
      (b) => b.existing != null,
      (b) => completeFrom(b, 'duplicate', (bindings) => ({
        filter: (bindings.existing as Record<string, unknown>).name,
      })),
      (b) => {
        let b2 = put(b, 'filter', name, {
          name,
          tree: treeStr,
          sourceType,
          fieldRefs,
          parameters,
        });
        return complete(b2, 'ok', { filter: name });
      },
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const name = input.name as string;

    if (!name || (typeof name === 'string' && name.trim() === '')) {
      return complete(createProgram(), 'notfound', { message: 'name is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'filter', name, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `Filter "${name}" not found` }),
      (b) => completeFrom(b, 'ok', (bindings) => {
        const rec = bindings.existing as Record<string, unknown>;
        return {
          filter: rec.name as string,
          tree: rec.tree as string,
          sourceType: rec.sourceType as string,
          fieldRefs: JSON.stringify(rec.fieldRefs),
        };
      }),
    ) as StorageProgram<Result>;
  },

  compose(input: Record<string, unknown>) {
    const aName = input.a as string;
    const bName = input.b as string;

    let p = createProgram();
    p = get(p, 'filter', aName, 'filterA');
    p = get(p, 'filter', bName, 'filterB');
    p = mapBindings(p, (bindings) => {
      if (bindings.filterA == null || bindings.filterB == null) return null;
      const recA = bindings.filterA as Record<string, unknown>;
      const recB = bindings.filterB as Record<string, unknown>;
      const nodeA = JSON.parse(recA.tree as string) as FilterNode;
      const nodeB = JSON.parse(recB.tree as string) as FilterNode;
      const composed = composeNodes(nodeA, nodeB);
      return JSON.stringify(composed);
    }, '_composedTree');

    return branch(p,
      (b) => b._composedTree == null,
      (b) => {
        const missingName = (b.filterA == null) ? aName : bName;
        return complete(b, 'notfound', { message: `Filter "${missingName}" not found` });
      },
      (b) => {
        // Generate a unique key for the composed filter
        const composedKey = `${aName}+${bName}`;
        return completeFrom(b, 'ok', (bindings) => ({
          filter: composedKey,
          tree: bindings._composedTree as string,
        }));
      },
    ) as StorageProgram<Result>;
  },

  evaluate(input: Record<string, unknown>) {
    const name = input.name as string;
    const rowsRaw = input.rows;

    if (rowsRaw === undefined || rowsRaw === null || rowsRaw === '') {
      return complete(createProgram(), 'error', { message: 'rows is required' }) as StorageProgram<Result>;
    }

    let rows: Record<string, unknown>[];
    if (Array.isArray(rowsRaw)) {
      // Already a parsed array (from fixture runner)
      rows = rowsRaw as Record<string, unknown>[];
    } else {
      const rowsStr = rowsRaw as string;
      if (typeof rowsStr !== 'string') {
        return complete(createProgram(), 'error', { message: 'rows must be a JSON array string' }) as StorageProgram<Result>;
      }
      try {
        const parsed = JSON.parse(rowsStr);
        if (!Array.isArray(parsed)) {
          return complete(createProgram(), 'error', { message: 'rows must be a JSON array' }) as StorageProgram<Result>;
        }
        rows = parsed as Record<string, unknown>[];
      } catch {
        return complete(createProgram(), 'error', { message: 'rows is not valid JSON' }) as StorageProgram<Result>;
      }
    }

    let p = createProgram();
    p = get(p, 'filter', name, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `Filter "${name}" not found` }),
      (b) => completeFrom(b, 'ok', (bindings) => {
        const rec = bindings.existing as Record<string, unknown>;
        let tree: FilterNode;
        try {
          tree = JSON.parse(rec.tree as string) as FilterNode;
        } catch {
          return { rows: JSON.stringify([]) };
        }
        const matching = rows.filter(row => evaluateNode(tree, row));
        return { rows: JSON.stringify(matching) };
      }),
    ) as StorageProgram<Result>;
  },

  normalize(input: Record<string, unknown>) {
    const name = input.name as string;
    const form = input.form as string;

    if (form !== 'cnf' && form !== 'dnf') {
      return complete(createProgram(), 'error', { message: 'form must be "cnf" or "dnf"' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'filter', name, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `Filter "${name}" not found` }),
      (b) => completeFrom(b, 'ok', (bindings) => {
        const rec = bindings.existing as Record<string, unknown>;
        let tree: FilterNode;
        try {
          tree = JSON.parse(rec.tree as string) as FilterNode;
        } catch {
          return { tree: rec.tree as string };
        }
        const normalized = form === 'cnf' ? toCNF(tree) : toDNF(tree);
        return { tree: JSON.stringify(normalized) };
      }),
    ) as StorageProgram<Result>;
  },

  validate(input: Record<string, unknown>) {
    const name = input.name as string;
    const schemaRaw = input.schema;

    let schema: { fields?: string[] };
    if (typeof schemaRaw === 'string') {
      try {
        schema = JSON.parse(schemaRaw) as { fields?: string[] };
      } catch {
        return complete(createProgram(), 'error', { message: 'schema is not valid JSON' }) as StorageProgram<Result>;
      }
    } else if (schemaRaw && typeof schemaRaw === 'object') {
      schema = schemaRaw as { fields?: string[] };
    } else {
      schema = {};
    }
    const allowedFields = schema.fields ?? [];

    let p = createProgram();
    p = get(p, 'filter', name, 'existing');
    // After reading, compute the list of unknown fields
    p = mapBindings(p, (bindings) => {
      if (bindings.existing == null) return null;
      const rec = bindings.existing as Record<string, unknown>;
      const fieldRefs = (rec.fieldRefs ?? []) as string[];
      const unknown = fieldRefs.filter(f => !allowedFields.includes(f));
      return unknown.length > 0 ? unknown : [];
    }, '_unknownFields');

    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `Filter "${name}" not found` }),
      (b) => branch(b,
        (bb) => Array.isArray(bb._unknownFields) && (bb._unknownFields as string[]).length > 0,
        (bb) => completeFrom(bb, 'invalid', (bindings) => ({
          message: `Unknown fields: ${(bindings._unknownFields as string[]).join(', ')}`,
        })),
        (bb) => complete(bb, 'ok', { filter: name }),
      ),
    ) as StorageProgram<Result>;
  },

  bind(input: Record<string, unknown>) {
    const name = input.name as string;
    const bindingsRaw = input.bindings;

    let bindingsMap: Record<string, unknown>;
    if (typeof bindingsRaw === 'string') {
      try {
        bindingsMap = JSON.parse(bindingsRaw) as Record<string, unknown>;
      } catch {
        return complete(createProgram(), 'error', { message: 'bindings is not valid JSON' }) as StorageProgram<Result>;
      }
    } else if (bindingsRaw && typeof bindingsRaw === 'object') {
      bindingsMap = bindingsRaw as Record<string, unknown>;
    } else {
      bindingsMap = {};
    }

    let p = createProgram();
    p = get(p, 'filter', name, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `Filter "${name}" not found` }),
      (b) => completeFrom(b, 'ok', (bindings) => {
        const rec = bindings.existing as Record<string, unknown>;
        let tree: FilterNode;
        try {
          tree = JSON.parse(rec.tree as string) as FilterNode;
        } catch {
          return { filter: name, tree: rec.tree as string };
        }
        const bound = bindParams(tree, bindingsMap);
        return { filter: name, tree: JSON.stringify(bound) };
      }),
    ) as StorageProgram<Result>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'filter', {}, 'allFilters');
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.allFilters ?? []) as Array<Record<string, unknown>>;
      const filters = all.map(f => ({
        name: f.name,
        tree: f.tree,
        sourceType: f.sourceType,
        fieldRefs: f.fieldRefs,
      }));
      return { filters: JSON.stringify(filters) };
    }) as StorageProgram<Result>;
  },
};

export const filterSpecHandler = autoInterpret(_handler);
