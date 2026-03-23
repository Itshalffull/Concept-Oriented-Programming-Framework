// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// DefinitionUnit Handler — Functional (StorageProgram) style
//
// Extracts definition-level nodes (functions, classes, types,
// interfaces, etc.) from parsed syntax trees as first-class
// entities. Enables content-addressed identity and structural
// diff across versions.
//
// See Architecture doc Section 4.1 (DefinitionUnit).
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';
import { createHash } from 'crypto';
import { getLiveTree } from './syntax-tree.handler.js';

let unitCounter = 0;
function nextUnitId(): string {
  return `def-unit-${++unitCounter}`;
}

// Node types that represent definitions, per language grammar
const DEFINITION_NODE_TYPES: Record<string, Set<string>> = {
  typescript: new Set([
    'function_declaration', 'class_declaration', 'interface_declaration',
    'type_alias_declaration', 'enum_declaration', 'method_definition',
    'abstract_class_declaration',
  ]),
  javascript: new Set([
    'function_declaration', 'class_declaration', 'method_definition',
  ]),
  concept: new Set(['concept_declaration']),
  sync: new Set(['sync_declaration']),
  yaml: new Set(['block_mapping_pair']),
};

// Map tree-sitter node types to human-readable definition kinds
const KIND_MAP: Record<string, string> = {
  function_declaration: 'function',
  class_declaration: 'class',
  abstract_class_declaration: 'class',
  interface_declaration: 'interface',
  type_alias_declaration: 'type',
  enum_declaration: 'enum',
  method_definition: 'method',
  concept_declaration: 'concept',
  sync_declaration: 'sync',
  block_mapping_pair: 'config-key',
};

/**
 * Find the nearest definition ancestor of a node (or the node itself).
 * Returns null if no definition ancestor exists.
 */
function findDefinitionNode(
  node: { type: string; parent: unknown; startIndex: number; endIndex: number; isNamed: boolean },
  allowedTypes: Set<string>,
): typeof node | null {
  let current: typeof node | null = node;
  while (current) {
    if (allowedTypes.has(current.type)) return current;
    current = current.parent as typeof node | null;
  }
  return null;
}

/**
 * Extract the name identifier from a definition node.
 */
function extractName(node: {
  type: string;
  childCount: number;
  child(i: number): { type: string; text: string; isNamed: boolean } | null;
  text: string;
}): string {
  // Look for a named child of type 'identifier' or 'type_identifier' or 'name'
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (!child) continue;
    if (
      child.type === 'identifier' ||
      child.type === 'type_identifier' ||
      child.type === 'name' ||
      child.type === 'property_identifier'
    ) {
      return child.text;
    }
  }
  // Fallback: first line of text, truncated
  const firstLine = node.text.split('\n')[0];
  return firstLine.slice(0, 60);
}

/**
 * Extract child definition names from a parent definition (e.g., methods in a class).
 */
function extractChildren(node: {
  type: string;
  childCount: number;
  child(i: number): {
    type: string;
    childCount: number;
    child(j: number): { type: string; text: string } | null;
  } | null;
}, allowedTypes: Set<string>): string[] {
  const children: string[] = [];

  function walk(n: typeof node) {
    for (let i = 0; i < n.childCount; i++) {
      const child = n.child(i);
      if (!child) continue;
      // Don't recurse into the node itself (only its body)
      if (child === node) continue;
      if (allowedTypes.has(child.type)) {
        // Extract the child's name
        for (let j = 0; j < child.childCount; j++) {
          const grandchild = child.child(j);
          if (
            grandchild &&
            (grandchild.type === 'identifier' ||
              grandchild.type === 'property_identifier' ||
              grandchild.type === 'type_identifier')
          ) {
            children.push(grandchild.text);
            break;
          }
        }
      }
      // Recurse into class/interface bodies
      if (
        child.type === 'class_body' ||
        child.type === 'interface_body' ||
        child.type === 'enum_body' ||
        child.type === 'statement_block'
      ) {
        walk(child as unknown as typeof node);
      }
    }
  }

  walk(node);
  return children;
}

type Result = { variant: string; [key: string]: unknown };

const _definitionUnitHandler: FunctionalConceptHandler = {
  extract(input: Record<string, unknown>) {
    if (!input.tree || (typeof input.tree === 'string' && (input.tree as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'tree is required' }) as StorageProgram<Result>;
    }
    const treeId = input.tree as string;
    const startByte = input.startByte as number;
    const endByte = input.endByte as number;

    if (!treeId) {
      return complete(createProgram(), 'notADefinition', { nodeType: 'missing tree ID' }) as StorageProgram<Result>;
    }

    // Look up tree metadata from SyntaxTree's storage
    let p = createProgram();
    p = get(p, 'tree', treeId, 'treeMeta');
    p = completeFrom(p, '_deferred_extract', (bindings) => {
      const treeMeta = bindings.treeMeta as Record<string, unknown> | null;

      // Get the live tree-sitter tree
      const liveTree = getLiveTree(treeId);
      if (!liveTree) {
        return { variant: 'notADefinition', nodeType: 'tree not in live cache' };
      }

      // Determine language from grammar metadata
      const grammar = (treeMeta?.grammar as string) || 'typescript';
      const languageName = grammar.includes('typescript') || grammar.includes('tsx')
        ? 'typescript'
        : grammar.includes('javascript') || grammar.includes('jsx')
          ? 'javascript'
          : grammar.includes('concept')
            ? 'concept'
            : grammar.includes('sync')
              ? 'sync'
              : grammar.includes('yaml')
                ? 'yaml'
                : 'typescript';

      const allowedTypes = DEFINITION_NODE_TYPES[languageName] || DEFINITION_NODE_TYPES.typescript;

      // Find the node at the byte range
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rootNode = liveTree.rootNode as any;
      const node = rootNode.descendantForIndex(startByte, endByte);
      if (!node) {
        return { variant: 'notADefinition', nodeType: 'no node at range' };
      }

      // Walk up to find the nearest definition node
      const defNode = findDefinitionNode(node, allowedTypes);
      if (!defNode) {
        return { variant: 'notADefinition', nodeType: node.type };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const typedDefNode = defNode as any;

      // Extract definition metadata
      const name = extractName(typedDefNode);
      const kind = KIND_MAP[typedDefNode.type] || typedDefNode.type;
      const text = typedDefNode.text as string;
      const digest = createHash('sha256').update(text).digest('hex').slice(0, 16);
      const treeRange = JSON.stringify({
        startByte: typedDefNode.startIndex,
        endByte: typedDefNode.endIndex,
        startRow: typedDefNode.startPosition?.row ?? 0,
        startCol: typedDefNode.startPosition?.column ?? 0,
        endRow: typedDefNode.endPosition?.row ?? 0,
        endCol: typedDefNode.endPosition?.column ?? 0,
      });
      const sourceFile = (treeMeta?.source as string) || '';
      const children = extractChildren(typedDefNode, allowedTypes);

      const id = nextUnitId();
      const symbolName = sourceFile ? `${sourceFile}:${name}` : name;

      return {
        variant: 'ok',
        unit: id,
        _unitData: {
          id,
          file: sourceFile,
          symbol: symbolName,
          treeRange,
          digest,
          kind,
          language: languageName,
          children: JSON.stringify(children),
          treeId,
          name,
        },
      };
    });

    return p as StorageProgram<Result>;
  },

  findBySymbol(input: Record<string, unknown>) {
    if (!input.symbol || (typeof input.symbol === 'string' && (input.symbol as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'symbol is required' }) as StorageProgram<Result>;
    }
    const symbol = input.symbol as string;
    if (!symbol) {
      return complete(createProgram(), 'notfound', {}) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'definition-unit', { symbol }, 'results');
    p = branch(p, (bindings) => {
      const results = (bindings.results as Array<Record<string, unknown>>) || [];
      return results.length > 0;
    },
      (b) => completeFrom(b, 'ok', (bindings) => {
        const results = bindings.results as Array<Record<string, unknown>>;
        return { unit: results[0].id as string };
      }),
      (b) => {
        // Also try matching by name suffix (without file prefix)
        let b2 = find(b, 'definition-unit', {}, 'all');
        b2 = mapBindings(b2, (bindings) => {
          const all = (bindings.all as Array<Record<string, unknown>>) || [];
          const match = all.find(u =>
            (u.symbol as string) === symbol ||
            (u.name as string) === symbol ||
            (u.symbol as string).endsWith(`:${symbol}`),
          );
          return match ? (match.id as string) : null;
        }, 'matchId');
        b2 = branch(b2, 'matchId',
          (b3) => completeFrom(b3, 'ok', (bindings) => ({ unit: bindings.matchId as string })),
          (b3) => complete(b3, 'notfound', {}),
        );
        return b2;
      },
    );

    return p as StorageProgram<Result>;
  },

  findByPattern(input: Record<string, unknown>) {
    const kind = input.kind as string;
    const language = input.language as string;
    const namePattern = input.namePattern as string;

    let p = createProgram();
    p = find(p, 'definition-unit', {}, 'all');
    p = completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.all as Array<Record<string, unknown>>) || [];

      const filtered = all.filter(u => {
        if (kind && (u.kind as string) !== kind) return false;
        if (language && (u.language as string) !== language) return false;
        if (namePattern) {
          try {
            const regex = new RegExp(namePattern);
            const name = (u.name as string) || (u.symbol as string) || '';
            if (!regex.test(name)) return false;
          } catch {
            // Invalid regex — treat as literal substring match
            const name = (u.name as string) || (u.symbol as string) || '';
            if (!name.includes(namePattern)) return false;
          }
        }
        return true;
      });

      const units = filtered.map(u => ({
        id: u.id,
        file: u.file,
        symbol: u.symbol,
        kind: u.kind,
        language: u.language,
        digest: u.digest,
      }));

      return { units: JSON.stringify(units) };
    });

    return p as StorageProgram<Result>;
  },

  diff(input: Record<string, unknown>) {
    if (!input.a || (typeof input.a === 'string' && (input.a as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'a is required' }) as StorageProgram<Result>;
    }
    if (!input.b || (typeof input.b === 'string' && (input.b as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'b is required' }) as StorageProgram<Result>;
    }
    const a = input.a as string;
    const b = input.b as string;

    if (!a || !b) {
      return complete(createProgram(), 'ok', {}) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'definition-unit', a, 'unitA');
    p = get(p, 'definition-unit', b, 'unitB');
    p = completeFrom(p, '_deferred_diff', (bindings) => {
      const unitA = bindings.unitA as Record<string, unknown> | null;
      const unitB = bindings.unitB as Record<string, unknown> | null;

      if (!unitA || !unitB) {
        return {
          variant: 'ok',
          changes: JSON.stringify({
            error: !unitA ? `Unit ${a} not found` : `Unit ${b} not found`,
          }),
        };
      }

      // Fast path: same digest means identical content
      if ((unitA.digest as string) === (unitB.digest as string)) {
        return { variant: 'same' };
      }

      // Compute structural differences
      const rangeA = JSON.parse((unitA.treeRange as string) || '{}');
      const rangeB = JSON.parse((unitB.treeRange as string) || '{}');
      const childrenA: string[] = JSON.parse((unitA.children as string) || '[]');
      const childrenB: string[] = JSON.parse((unitB.children as string) || '[]');

      const changes = {
        kindChanged: (unitA.kind as string) !== (unitB.kind as string),
        symbolChanged: (unitA.name as string) !== (unitB.name as string),
        sizeChange: (rangeB.endByte - rangeB.startByte) - (rangeA.endByte - rangeA.startByte),
        childrenAdded: childrenB.filter((c: string) => !childrenA.includes(c)),
        childrenRemoved: childrenA.filter((c: string) => !childrenB.includes(c)),
        digestA: unitA.digest as string,
        digestB: unitB.digest as string,
      };

      return { variant: 'ok', changes: JSON.stringify(changes) };
    });

    return p as StorageProgram<Result>;
  },
};

export const definitionUnitHandler = autoInterpret(_definitionUnitHandler);
