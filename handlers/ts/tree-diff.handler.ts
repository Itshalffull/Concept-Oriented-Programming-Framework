// @migrated dsl-constructs 2026-03-18
// ============================================================
// TreeDiff Handler
//
// Compute structure-aware diffs for tree-shaped content such as
// XML, JSON, and ASTs. Uses tree edit distance to preserve
// structural relationships lost by line-oriented diffs.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, put, complete,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `tree-diff-${++idCounter}`;
}

interface TreeNode {
  label: string;
  value?: unknown;
  children: TreeNode[];
}

interface TreeEditOp {
  type: 'insert' | 'delete' | 'update' | 'move' | 'equal';
  path: string;
  oldValue?: unknown;
  newValue?: unknown;
}

/**
 * Convert a JSON value into a labeled tree structure.
 */
function jsonToTree(value: unknown, label: string = 'root'): TreeNode {
  if (value === null || value === undefined) {
    return { label, value: null, children: [] };
  }
  if (typeof value !== 'object') {
    return { label, value, children: [] };
  }
  if (Array.isArray(value)) {
    return {
      label,
      children: value.map((item, i) => jsonToTree(item, `[${i}]`)),
    };
  }
  return {
    label,
    children: Object.entries(value).map(([key, val]) => jsonToTree(val, key)),
  };
}

/**
 * Compute structural diff between two JSON trees.
 */
function diffTrees(nodeA: TreeNode, nodeB: TreeNode, path: string = ''): TreeEditOp[] {
  const ops: TreeEditOp[] = [];
  const currentPath = path ? `${path}.${nodeA.label}` : nodeA.label;

  if (nodeA.children.length === 0 && nodeB.children.length === 0) {
    if (nodeA.value === nodeB.value) {
      ops.push({ type: 'equal', path: currentPath });
    } else {
      ops.push({ type: 'update', path: currentPath, oldValue: nodeA.value, newValue: nodeB.value });
    }
    return ops;
  }

  const childrenA = new Map(nodeA.children.map(c => [c.label, c]));
  const childrenB = new Map(nodeB.children.map(c => [c.label, c]));

  for (const [label, childA] of childrenA) {
    const childB = childrenB.get(label);
    if (childB) {
      ops.push(...diffTrees(childA, childB, currentPath));
    } else {
      ops.push({ type: 'delete', path: `${currentPath}.${label}`, oldValue: treeToValue(childA) });
    }
  }

  for (const [label, childB] of childrenB) {
    if (!childrenA.has(label)) {
      ops.push({ type: 'insert', path: `${currentPath}.${label}`, newValue: treeToValue(childB) });
    }
  }

  return ops;
}

/**
 * Convert a tree node back to a plain value for serialization.
 */
function treeToValue(node: TreeNode): unknown {
  if (node.children.length === 0) return node.value;
  if (node.children.length > 0 && node.children[0].label.startsWith('[')) {
    return node.children.map(c => treeToValue(c));
  }
  const obj: Record<string, unknown> = {};
  for (const child of node.children) {
    obj[child.label] = treeToValue(child);
  }
  return obj;
}

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', {
      name: 'tree',
      category: 'diff',
      contentTypes: ['application/json', 'application/xml', 'text/xml'],
    }) as StorageProgram<Result>;
  },

  compute(input: Record<string, unknown>) {
    const contentA = input.contentA as string;
    const contentB = input.contentB as string;

    let parsedA: unknown;
    let parsedB: unknown;

    try {
      parsedA = JSON.parse(contentA);
    } catch {
      const p = createProgram();
      return complete(p, 'unsupportedContent', { message: 'Content A is not a valid tree structure (failed JSON parse)' }) as StorageProgram<Result>;
    }

    try {
      parsedB = JSON.parse(contentB);
    } catch {
      const p = createProgram();
      return complete(p, 'unsupportedContent', { message: 'Content B is not a valid tree structure (failed JSON parse)' }) as StorageProgram<Result>;
    }

    const treeA = jsonToTree(parsedA);
    const treeB = jsonToTree(parsedB);

    const editOps = diffTrees(treeA, treeB);
    const distance = editOps.filter(op => op.type !== 'equal').length;
    const editScript = JSON.stringify(editOps);

    const id = nextId();
    let p = createProgram();
    p = put(p, 'tree-diff', id, {
      id,
      editScript,
      distance,
    });

    return complete(p, 'ok', { editScript, distance }) as StorageProgram<Result>;
  },
};

export const treeDiffHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetTreeDiffCounter(): void {
  idCounter = 0;
}
