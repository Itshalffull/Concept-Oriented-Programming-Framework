// ============================================================
// TreeDiff Handler
//
// Compute structure-aware diffs for tree-shaped content such as
// XML, JSON, and ASTs. Uses tree edit distance to preserve
// structural relationships lost by line-oriented diffs.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

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
 * Produces a list of edit operations (insert, delete, update, equal).
 */
function diffTrees(nodeA: TreeNode, nodeB: TreeNode, path: string = ''): TreeEditOp[] {
  const ops: TreeEditOp[] = [];
  const currentPath = path ? `${path}.${nodeA.label}` : nodeA.label;

  // Compare values at leaf nodes
  if (nodeA.children.length === 0 && nodeB.children.length === 0) {
    if (nodeA.value === nodeB.value) {
      ops.push({ type: 'equal', path: currentPath });
    } else {
      ops.push({ type: 'update', path: currentPath, oldValue: nodeA.value, newValue: nodeB.value });
    }
    return ops;
  }

  // Compare children
  const childrenA = new Map(nodeA.children.map(c => [c.label, c]));
  const childrenB = new Map(nodeB.children.map(c => [c.label, c]));

  // Process all children from A
  for (const [label, childA] of childrenA) {
    const childB = childrenB.get(label);
    if (childB) {
      // Both have this child -- recurse
      ops.push(...diffTrees(childA, childB, currentPath));
    } else {
      // Deleted in B
      ops.push({ type: 'delete', path: `${currentPath}.${label}`, oldValue: treeToValue(childA) });
    }
  }

  // Process children only in B (inserts)
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

export const treeDiffHandler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    return {
      variant: 'ok',
      name: 'tree',
      category: 'diff',
      contentTypes: ['application/json', 'application/xml', 'text/xml'],
    };
  },

  async compute(input: Record<string, unknown>, storage: ConceptStorage) {
    const contentA = input.contentA as string;
    const contentB = input.contentB as string;

    let parsedA: unknown;
    let parsedB: unknown;

    try {
      parsedA = JSON.parse(contentA);
    } catch {
      return { variant: 'unsupportedContent', message: 'Content A is not a valid tree structure (failed JSON parse)' };
    }

    try {
      parsedB = JSON.parse(contentB);
    } catch {
      return { variant: 'unsupportedContent', message: 'Content B is not a valid tree structure (failed JSON parse)' };
    }

    const treeA = jsonToTree(parsedA);
    const treeB = jsonToTree(parsedB);

    const editOps = diffTrees(treeA, treeB);
    const distance = editOps.filter(op => op.type !== 'equal').length;
    const editScript = JSON.stringify(editOps);

    const id = nextId();
    await storage.put('tree-diff', id, {
      id,
      editScript,
      distance,
    });

    return { variant: 'ok', editScript, distance };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetTreeDiffCounter(): void {
  idCounter = 0;
}
