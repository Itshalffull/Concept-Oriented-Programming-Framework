// @clef-handler style=functional
// SplitLayout Concept Handler
//
// Manages a recursive tree of horizontal and vertical splits with resizable
// dividers, size ratios, and collapse behavior. The tree state is stored as
// a JSON string in the 'layout' storage relation.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram,
  get,
  put,
  putFrom,
  branch,
  complete,
  completeFrom,
  mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

// --- Tree node types ---

interface LeafNode {
  id: string;
  type: 'leaf';
  contentRef: string;
}

interface SplitNode {
  id: string;
  type: 'split';
  direction: 'horizontal' | 'vertical';
  ratio: number;
  children: [string, string];
  nodes: Record<string, TreeNode>;
  collapsed?: 'first' | 'second';
}

type TreeNode = LeafNode | SplitNode;

interface TreeRoot extends SplitNode {
  // Root split node; may also be a LeafNode at the tree level
}

type Tree = TreeNode; // root of the tree

// --- Numeric helpers ---

/**
 * Parse a ratio value that may be supplied as a string or number.
 * Returns NaN on failure.
 */
function parseRatio(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = parseFloat(value);
    return n;
  }
  return NaN;
}

// --- Validation helpers ---

/**
 * Validate a tree node recursively.
 * Returns an error message string on failure, or null on success.
 */
function validateTree(node: unknown): string | null {
  if (typeof node !== 'object' || node === null) {
    return 'tree node must be an object';
  }
  const n = node as Record<string, unknown>;
  if (typeof n.id !== 'string' || n.id === '') {
    return 'tree node must have a string id';
  }
  if (n.type === 'leaf') {
    if (typeof n.contentRef !== 'string') {
      return `leaf node "${n.id}" must have a contentRef string`;
    }
    return null;
  } else if (n.type === 'split') {
    if (n.direction !== 'horizontal' && n.direction !== 'vertical') {
      return `split node "${n.id}" direction must be "horizontal" or "vertical"`;
    }
    const ratio = n.ratio as number;
    if (typeof ratio !== 'number' || ratio <= 0 || ratio >= 1) {
      return `split node "${n.id}" ratio must be between 0 and 1 exclusive`;
    }
    if (!Array.isArray(n.children) || n.children.length !== 2) {
      return `split node "${n.id}" must have exactly 2 children`;
    }
    const nodes = n.nodes as Record<string, unknown> | undefined;
    if (typeof nodes !== 'object' || nodes === null) {
      return `split node "${n.id}" must have a nodes map`;
    }
    for (const childId of n.children as string[]) {
      const child = nodes[childId];
      if (!child) {
        return `split node "${n.id}" references missing child "${childId}"`;
      }
      const childErr = validateTree(child);
      if (childErr) return childErr;
    }
    return null;
  } else {
    return `unknown node type "${n.type}"`;
  }
}

/**
 * Find a node by ID within the tree, searching recursively.
 * Returns the node if found, or null.
 */
function findNode(tree: TreeNode, nodeId: string): TreeNode | null {
  if (tree.id === nodeId) return tree;
  if (tree.type === 'split') {
    for (const childId of tree.children) {
      const child = tree.nodes[childId];
      if (child) {
        const found = findNode(child, nodeId);
        if (found) return found;
      }
    }
  }
  return null;
}

/**
 * Update a node within the tree by ID, returning a new tree with the
 * replacement node in place. Returns null if the node was not found.
 */
function replaceNode(tree: TreeNode, nodeId: string, replacement: TreeNode): TreeNode | null {
  if (tree.id === nodeId) return replacement;
  if (tree.type === 'split') {
    let changed = false;
    const newNodes: Record<string, TreeNode> = {};
    for (const [k, child] of Object.entries(tree.nodes)) {
      const updated = replaceNode(child, nodeId, replacement);
      if (updated) {
        newNodes[k] = updated;
        changed = true;
      } else {
        newNodes[k] = child;
      }
    }
    if (!changed) return null;
    return { ...tree, nodes: newNodes };
  }
  return null;
}

/**
 * Generate a short unique-ish node ID based on timestamp+random.
 * Not truly UUID, but sufficient for in-memory keys.
 */
function generateNodeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// --- Handler ---

type Result = { variant: string; [key: string]: unknown };

const _splitLayoutHandler: FunctionalConceptHandler = {

  register(_input: Record<string, unknown>) {
    return complete(createProgram(), 'ok', { name: 'SplitLayout' }) as StorageProgram<Result>;
  },

  create(input: Record<string, unknown>) {
    const layoutId = input.layout as string;
    const name = input.name as string;
    const treeStr = input.tree as string;

    // Validate name
    if (!name || name.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'name is required' }) as StorageProgram<Result>;
    }

    // Validate tree JSON
    let parsedTree: unknown;
    try {
      parsedTree = JSON.parse(treeStr);
    } catch {
      return complete(createProgram(), 'invalid', { message: 'tree is not valid JSON' }) as StorageProgram<Result>;
    }

    // Validate tree structure
    const treeErr = validateTree(parsedTree);
    if (treeErr) {
      return complete(createProgram(), 'invalid', { message: treeErr }) as StorageProgram<Result>;
    }

    // Check uniqueness
    let p = createProgram();
    p = get(p, 'layout', layoutId, 'existing');
    return branch(p,
      'existing',
      complete(createProgram(), 'error', { message: 'a layout with this identifier already exists' }),
      (() => {
        let b = createProgram();
        b = put(b, 'layout', layoutId, { layout: layoutId, name, tree: treeStr });
        return complete(b, 'ok', { layout: layoutId });
      })(),
    ) as StorageProgram<Result>;
  },

  split(input: Record<string, unknown>) {
    const layoutId = input.layout as string;
    const leafId = input.leafId as string;
    const direction = input.direction as string;
    const ratio = parseRatio(input.ratio);

    // Validate direction
    if (direction !== 'horizontal' && direction !== 'vertical') {
      return complete(createProgram(), 'invalid', { message: 'direction must be "horizontal" or "vertical"' }) as StorageProgram<Result>;
    }

    // Validate ratio (exclusive: must be > 0 and < 1)
    if (isNaN(ratio) || ratio <= 0 || ratio >= 1) {
      return complete(createProgram(), 'invalid', { message: 'ratio must be strictly between 0 and 1' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'layout', layoutId, 'layoutRecord');
    return branch(p,
      'layoutRecord',
      // Layout found — parse tree and apply split
      (() => {
        let b = createProgram();
        b = mapBindings(b, (bindings) => {
          const record = bindings.layoutRecord as Record<string, unknown>;
          let tree: TreeNode;
          try {
            tree = JSON.parse(record.tree as string) as TreeNode;
          } catch {
            return { _error: 'tree JSON is corrupt' };
          }
          const target = findNode(tree, leafId);
          if (!target) {
            return { _notfound: `leaf "${leafId}" not found` };
          }
          if (target.type !== 'leaf') {
            return { _notfound: `node "${leafId}" is not a leaf` };
          }
          // Build new split node
          const leftId = generateNodeId('leaf');
          const rightId = generateNodeId('leaf');
          const splitId = generateNodeId('split');
          const leftLeaf: LeafNode = { id: leftId, type: 'leaf', contentRef: target.contentRef };
          const rightLeaf: LeafNode = { id: rightId, type: 'leaf', contentRef: '' };
          const newSplit: SplitNode = {
            id: splitId,
            type: 'split',
            direction: direction as 'horizontal' | 'vertical',
            ratio,
            children: [leftId, rightId],
            nodes: { [leftId]: leftLeaf, [rightId]: rightLeaf },
          };
          // Replace the leaf with the new split node in the tree
          const newTree = replaceNode(tree, leafId, newSplit) ?? newSplit;
          return { _newTree: JSON.stringify(newTree), _splitId: splitId, _leftId: leftId, _rightId: rightId };
        }, '_splitResult');

        return branch(b,
          (bindings) => {
            const r = bindings._splitResult as Record<string, unknown>;
            return r && '_notfound' in r;
          },
          completeFrom(createProgram(), 'notfound', (bindings) => {
            const r = bindings._splitResult as Record<string, unknown>;
            return { message: r._notfound as string };
          }),
          (() => {
            let b2 = createProgram();
            b2 = putFrom(b2, 'layout', layoutId, (bindings) => {
              const record = bindings.layoutRecord as Record<string, unknown>;
              const r = bindings._splitResult as Record<string, unknown>;
              return { ...record, tree: r._newTree as string };
            });
            return completeFrom(b2, 'ok', (bindings) => {
              const r = bindings._splitResult as Record<string, unknown>;
              return {
                layout: layoutId,
                splitId: r._splitId as string,
                leftId: r._leftId as string,
                rightId: r._rightId as string,
              };
            });
          })(),
        );
      })(),
      // Layout not found
      complete(createProgram(), 'notfound', { message: 'no layout with this identifier exists' }),
    ) as StorageProgram<Result>;
  },

  unsplit(input: Record<string, unknown>) {
    const layoutId = input.layout as string;
    const splitId = input.splitId as string;
    const keepSide = input.keepSide as string;

    // Validate keepSide
    if (keepSide !== 'first' && keepSide !== 'second') {
      return complete(createProgram(), 'invalid', { message: 'keepSide must be "first" or "second"' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'layout', layoutId, 'layoutRecord');
    return branch(p,
      'layoutRecord',
      (() => {
        let b = createProgram();
        b = mapBindings(b, (bindings) => {
          const record = bindings.layoutRecord as Record<string, unknown>;
          let tree: TreeNode;
          try {
            tree = JSON.parse(record.tree as string) as TreeNode;
          } catch {
            return { _error: 'tree JSON is corrupt' };
          }
          const target = findNode(tree, splitId);
          if (!target) {
            return { _notfound: `split "${splitId}" not found` };
          }
          if (target.type !== 'split') {
            return { _notfound: `node "${splitId}" is not a split` };
          }
          // Determine surviving child
          const survivingChildId = keepSide === 'first'
            ? target.children[0]
            : target.children[1];
          const survivingChild = target.nodes[survivingChildId];
          if (!survivingChild) {
            return { _notfound: `child "${survivingChildId}" not found in split` };
          }
          // Replace the split node with the surviving child
          const newTree = replaceNode(tree, splitId, survivingChild) ?? survivingChild;
          return { _newTree: JSON.stringify(newTree), _survivingLeafId: survivingChildId };
        }, '_unsplitResult');

        return branch(b,
          (bindings) => {
            const r = bindings._unsplitResult as Record<string, unknown>;
            return r && '_notfound' in r;
          },
          completeFrom(createProgram(), 'notfound', (bindings) => {
            const r = bindings._unsplitResult as Record<string, unknown>;
            return { message: r._notfound as string };
          }),
          (() => {
            let b2 = createProgram();
            b2 = putFrom(b2, 'layout', layoutId, (bindings) => {
              const record = bindings.layoutRecord as Record<string, unknown>;
              const r = bindings._unsplitResult as Record<string, unknown>;
              return { ...record, tree: r._newTree as string };
            });
            return completeFrom(b2, 'ok', (bindings) => {
              const r = bindings._unsplitResult as Record<string, unknown>;
              return { layout: layoutId, survivingLeafId: r._survivingLeafId as string };
            });
          })(),
        );
      })(),
      complete(createProgram(), 'notfound', { message: 'no layout with this identifier exists' }),
    ) as StorageProgram<Result>;
  },

  resize(input: Record<string, unknown>) {
    const layoutId = input.layout as string;
    const splitId = input.splitId as string;
    const ratio = input.ratio as number;

    // Validate ratio (exclusive: > 0 and < 1)
    if (typeof ratio !== 'number' || ratio <= 0 || ratio >= 1) {
      return complete(createProgram(), 'invalid', { message: 'ratio must be strictly between 0 and 1' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'layout', layoutId, 'layoutRecord');
    return branch(p,
      'layoutRecord',
      (() => {
        let b = createProgram();
        b = mapBindings(b, (bindings) => {
          const record = bindings.layoutRecord as Record<string, unknown>;
          let tree: TreeNode;
          try {
            tree = JSON.parse(record.tree as string) as TreeNode;
          } catch {
            return { _notfound: 'tree JSON is corrupt' };
          }
          const target = findNode(tree, splitId);
          if (!target) {
            return { _notfound: `split "${splitId}" not found` };
          }
          if (target.type !== 'split') {
            return { _notfound: `node "${splitId}" is not a split` };
          }
          const updatedNode: SplitNode = { ...target, ratio };
          const newTree = replaceNode(tree, splitId, updatedNode) ?? updatedNode;
          return { _newTree: JSON.stringify(newTree) };
        }, '_resizeResult');

        return branch(b,
          (bindings) => {
            const r = bindings._resizeResult as Record<string, unknown>;
            return r && '_notfound' in r;
          },
          completeFrom(createProgram(), 'notfound', (bindings) => {
            const r = bindings._resizeResult as Record<string, unknown>;
            return { message: r._notfound as string };
          }),
          (() => {
            let b2 = createProgram();
            b2 = putFrom(b2, 'layout', layoutId, (bindings) => {
              const record = bindings.layoutRecord as Record<string, unknown>;
              const r = bindings._resizeResult as Record<string, unknown>;
              return { ...record, tree: r._newTree as string };
            });
            return complete(b2, 'ok', { layout: layoutId });
          })(),
        );
      })(),
      complete(createProgram(), 'notfound', { message: 'no layout with this identifier exists' }),
    ) as StorageProgram<Result>;
  },

  collapse(input: Record<string, unknown>) {
    const layoutId = input.layout as string;
    const splitId = input.splitId as string;
    const side = input.side as string;

    // Validate side
    if (side !== 'first' && side !== 'second') {
      return complete(createProgram(), 'invalid', { message: 'side must be "first" or "second"' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'layout', layoutId, 'layoutRecord');
    return branch(p,
      'layoutRecord',
      (() => {
        let b = createProgram();
        b = mapBindings(b, (bindings) => {
          const record = bindings.layoutRecord as Record<string, unknown>;
          let tree: TreeNode;
          try {
            tree = JSON.parse(record.tree as string) as TreeNode;
          } catch {
            return { _notfound: 'tree JSON is corrupt' };
          }
          const target = findNode(tree, splitId);
          if (!target) {
            return { _notfound: `split "${splitId}" not found` };
          }
          if (target.type !== 'split') {
            return { _notfound: `node "${splitId}" is not a split` };
          }
          // Check if already collapsed on that side
          if (target.collapsed === side) {
            return { _invalid: `side "${side}" is already collapsed` };
          }
          const updatedNode: SplitNode = { ...target, collapsed: side as 'first' | 'second' };
          const newTree = replaceNode(tree, splitId, updatedNode) ?? updatedNode;
          return { _newTree: JSON.stringify(newTree) };
        }, '_collapseResult');

        return branch(b,
          (bindings) => {
            const r = bindings._collapseResult as Record<string, unknown>;
            return r && '_notfound' in r;
          },
          completeFrom(createProgram(), 'notfound', (bindings) => {
            const r = bindings._collapseResult as Record<string, unknown>;
            return { message: r._notfound as string };
          }),
          branch(createProgram(),
            (bindings) => {
              const r = bindings._collapseResult as Record<string, unknown>;
              return r && '_invalid' in r;
            },
            completeFrom(createProgram(), 'invalid', (bindings) => {
              const r = bindings._collapseResult as Record<string, unknown>;
              return { message: r._invalid as string };
            }),
            (() => {
              let b2 = createProgram();
              b2 = putFrom(b2, 'layout', layoutId, (bindings) => {
                const record = bindings.layoutRecord as Record<string, unknown>;
                const r = bindings._collapseResult as Record<string, unknown>;
                return { ...record, tree: r._newTree as string };
              });
              return complete(b2, 'ok', { layout: layoutId });
            })(),
          ),
        );
      })(),
      complete(createProgram(), 'notfound', { message: 'no layout with this identifier exists' }),
    ) as StorageProgram<Result>;
  },

  expand(input: Record<string, unknown>) {
    const layoutId = input.layout as string;
    const splitId = input.splitId as string;

    let p = createProgram();
    p = get(p, 'layout', layoutId, 'layoutRecord');
    return branch(p,
      'layoutRecord',
      (() => {
        let b = createProgram();
        b = mapBindings(b, (bindings) => {
          const record = bindings.layoutRecord as Record<string, unknown>;
          let tree: TreeNode;
          try {
            tree = JSON.parse(record.tree as string) as TreeNode;
          } catch {
            return { _notfound: 'tree JSON is corrupt' };
          }
          const target = findNode(tree, splitId);
          if (!target) {
            return { _notfound: `split "${splitId}" not found` };
          }
          if (target.type !== 'split') {
            return { _notfound: `node "${splitId}" is not a split` };
          }
          if (!target.collapsed) {
            return { _notfound: 'neither side of this split is currently collapsed' };
          }
          const updatedNode: SplitNode = { ...target };
          delete (updatedNode as Partial<SplitNode>).collapsed;
          const newTree = replaceNode(tree, splitId, updatedNode) ?? updatedNode;
          return { _newTree: JSON.stringify(newTree) };
        }, '_expandResult');

        return branch(b,
          (bindings) => {
            const r = bindings._expandResult as Record<string, unknown>;
            return r && '_notfound' in r;
          },
          completeFrom(createProgram(), 'notfound', (bindings) => {
            const r = bindings._expandResult as Record<string, unknown>;
            return { message: r._notfound as string };
          }),
          (() => {
            let b2 = createProgram();
            b2 = putFrom(b2, 'layout', layoutId, (bindings) => {
              const record = bindings.layoutRecord as Record<string, unknown>;
              const r = bindings._expandResult as Record<string, unknown>;
              return { ...record, tree: r._newTree as string };
            });
            return complete(b2, 'ok', { layout: layoutId });
          })(),
        );
      })(),
      complete(createProgram(), 'notfound', { message: 'no layout with this identifier exists' }),
    ) as StorageProgram<Result>;
  },

  setContent(input: Record<string, unknown>) {
    const layoutId = input.layout as string;
    const leafId = input.leafId as string;
    const contentRef = input.contentRef as string;

    // Validate contentRef
    if (!contentRef || contentRef.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'contentRef is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'layout', layoutId, 'layoutRecord');
    return branch(p,
      'layoutRecord',
      (() => {
        let b = createProgram();
        b = mapBindings(b, (bindings) => {
          const record = bindings.layoutRecord as Record<string, unknown>;
          let tree: TreeNode;
          try {
            tree = JSON.parse(record.tree as string) as TreeNode;
          } catch {
            return { _notfound: 'tree JSON is corrupt' };
          }
          const target = findNode(tree, leafId);
          if (!target) {
            return { _notfound: `leaf "${leafId}" not found` };
          }
          if (target.type !== 'leaf') {
            return { _notfound: `node "${leafId}" is not a leaf` };
          }
          const updatedLeaf: LeafNode = { ...target, contentRef };
          const newTree = replaceNode(tree, leafId, updatedLeaf) ?? updatedLeaf;
          return { _newTree: JSON.stringify(newTree) };
        }, '_setContentResult');

        return branch(b,
          (bindings) => {
            const r = bindings._setContentResult as Record<string, unknown>;
            return r && '_notfound' in r;
          },
          completeFrom(createProgram(), 'notfound', (bindings) => {
            const r = bindings._setContentResult as Record<string, unknown>;
            return { message: r._notfound as string };
          }),
          (() => {
            let b2 = createProgram();
            b2 = putFrom(b2, 'layout', layoutId, (bindings) => {
              const record = bindings.layoutRecord as Record<string, unknown>;
              const r = bindings._setContentResult as Record<string, unknown>;
              return { ...record, tree: r._newTree as string };
            });
            return complete(b2, 'ok', { layout: layoutId });
          })(),
        );
      })(),
      complete(createProgram(), 'notfound', { message: 'no layout with this identifier exists' }),
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const layoutId = input.layout as string;

    let p = createProgram();
    p = get(p, 'layout', layoutId, 'layoutRecord');
    return branch(p,
      'layoutRecord',
      completeFrom(createProgram(), 'ok', (bindings) => {
        const record = bindings.layoutRecord as Record<string, unknown>;
        return { layout: record.layout as string, name: record.name as string };
      }),
      complete(createProgram(), 'notfound', { message: 'no layout with this identifier exists' }),
    ) as StorageProgram<Result>;
  },

  getTree(input: Record<string, unknown>) {
    const layoutId = input.layout as string;

    let p = createProgram();
    p = get(p, 'layout', layoutId, 'layoutRecord');
    return branch(p,
      'layoutRecord',
      completeFrom(createProgram(), 'ok', (bindings) => {
        const record = bindings.layoutRecord as Record<string, unknown>;
        return { layout: record.layout as string, tree: record.tree as string };
      }),
      complete(createProgram(), 'notfound', { message: 'no layout with this identifier exists' }),
    ) as StorageProgram<Result>;
  },
};

export const splitLayoutHandler = autoInterpret(_splitLayoutHandler);
