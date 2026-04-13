/**
 * Block Tree Utilities — immutable tree operations for the block editor.
 *
 * Blocks form a tree via optional `children` arrays. These utilities
 * flatten, find, insert, remove, indent, and outdent blocks within
 * the tree while preserving immutability.
 */

import type { Block, BlockType } from './block-serialization';

// ─── Types ────────────────────────────────────────────────────────────────

export interface FlatEntry {
  block: Block;
  depth: number;
  parentId: string | null;
  indexInParent: number;
}

export interface FindResult {
  block: Block;
  parent: Block[]; // the array containing the block
  index: number;   // index within that array
}

// ─── Flatten ──────────────────────────────────────────────────────────────

/**
 * Flatten a block tree into a linear list with depth information.
 * When `skipCollapsed` is true, children of collapsed blocks are omitted.
 */
export function flattenTree(blocks: Block[], skipCollapsed = false): FlatEntry[] {
  const result: FlatEntry[] = [];

  function walk(list: Block[], depth: number, parentId: string | null) {
    for (let i = 0; i < list.length; i++) {
      const block = list[i];
      result.push({ block, depth, parentId, indexInParent: i });
      if (block.children && block.children.length > 0) {
        if (!skipCollapsed || !block.collapsed) {
          walk(block.children, depth + 1, block.id);
        }
      }
    }
  }

  walk(blocks, 0, null);
  return result;
}

// ─── Find ─────────────────────────────────────────────────────────────────

/**
 * Locate a block by ID anywhere in the tree.
 * Returns the block, the array it belongs to, and its index.
 */
export function findBlock(blocks: Block[], id: string): FindResult | null {
  function search(list: Block[]): FindResult | null {
    for (let i = 0; i < list.length; i++) {
      if (list[i].id === id) return { block: list[i], parent: list, index: i };
      if (list[i].children) {
        const found = search(list[i].children!);
        if (found) return found;
      }
    }
    return null;
  }
  return search(blocks);
}

// ─── Deep Clone ───────────────────────────────────────────────────────────

function cloneTree(blocks: Block[]): Block[] {
  return blocks.map(b => ({
    ...b,
    children: b.children ? cloneTree(b.children) : undefined,
  }));
}

// ─── Update ───────────────────────────────────────────────────────────────

/**
 * Return a new tree with one block updated via an updater function.
 */
export function updateBlock(
  blocks: Block[],
  id: string,
  updater: (block: Block) => Block,
): Block[] {
  return blocks.map(b => {
    if (b.id === id) return updater(b);
    if (b.children) {
      const updated = updateBlock(b.children, id, updater);
      if (updated !== b.children) return { ...b, children: updated };
    }
    return b;
  });
}

// ─── Remove ───────────────────────────────────────────────────────────────

/**
 * Remove a block from the tree. Returns the new tree and the removed block.
 */
export function removeBlock(
  blocks: Block[],
  id: string,
): { tree: Block[]; removed: Block | null } {
  const tree = cloneTree(blocks);
  const found = findBlock(tree, id);
  if (!found) return { tree: blocks, removed: null };
  found.parent.splice(found.index, 1);
  return { tree, removed: found.block };
}

// ─── Insert ───────────────────────────────────────────────────────────────

/**
 * Insert a block relative to a target.
 * - 'before' / 'after': as a sibling
 * - 'child': as the last child of the target
 */
export function insertBlock(
  blocks: Block[],
  targetId: string,
  block: Block,
  position: 'before' | 'after' | 'child',
): Block[] {
  const tree = cloneTree(blocks);
  const found = findBlock(tree, targetId);
  if (!found) return blocks;

  if (position === 'child') {
    const target = found.block;
    if (!target.children) target.children = [];
    target.children.push(block);
  } else {
    const offset = position === 'before' ? 0 : 1;
    found.parent.splice(found.index + offset, 0, block);
  }

  return tree;
}

// ─── Indent ───────────────────────────────────────────────────────────────

/**
 * Indent: make this block the last child of its previous sibling.
 * Returns the original tree if the block has no previous sibling.
 */
export function indentBlock(blocks: Block[], id: string): Block[] {
  const tree = cloneTree(blocks);
  const found = findBlock(tree, id);
  if (!found || found.index === 0) return blocks;

  const prevSibling = found.parent[found.index - 1];
  // Remove from current position
  found.parent.splice(found.index, 1);
  // Add as last child of previous sibling
  if (!prevSibling.children) prevSibling.children = [];
  prevSibling.children.push(found.block);

  return tree;
}

// ─── Outdent ──────────────────────────────────────────────────────────────

/**
 * Outdent: move block to after its parent at the parent's level.
 * Any siblings after this block in the same list become its children.
 */
export function outdentBlock(blocks: Block[], id: string): Block[] {
  const tree = cloneTree(blocks);
  const found = findBlock(tree, id);
  if (!found) return blocks;

  // Find the parent block (the block whose children array contains this block)
  const parentResult = findParentBlock(tree, id);
  if (!parentResult) return blocks; // already at root level

  const { parentBlock, grandparentList, parentIndex } = parentResult;

  // Remove this block from parent's children
  const childIdx = parentBlock.children!.indexOf(found.block);
  if (childIdx === -1) return blocks;

  // Siblings after this block become this block's children
  const trailingChildren = parentBlock.children!.splice(childIdx + 1);
  parentBlock.children!.splice(childIdx, 1);

  if (trailingChildren.length > 0) {
    if (!found.block.children) found.block.children = [];
    found.block.children.push(...trailingChildren);
  }

  // Clean up empty children array
  if (parentBlock.children!.length === 0) {
    delete parentBlock.children;
  }

  // Insert after parent in grandparent list
  grandparentList.splice(parentIndex + 1, 0, found.block);

  return tree;
}

interface ParentResult {
  parentBlock: Block;
  grandparentList: Block[];
  parentIndex: number;
}

function findParentBlock(blocks: Block[], childId: string): ParentResult | null {
  function search(list: Block[]): ParentResult | null {
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (b.children) {
        if (b.children.some(c => c.id === childId)) {
          return { parentBlock: b, grandparentList: list, parentIndex: i };
        }
        const found = search(b.children);
        if (found) return found;
      }
    }
    return null;
  }
  return search(blocks);
}

// ─── Move ─────────────────────────────────────────────────────────────────

/**
 * Move a block from one position to another via remove + insert.
 */
export function moveBlock(
  blocks: Block[],
  fromId: string,
  toId: string,
  position: 'before' | 'after' | 'child',
): Block[] {
  const { tree, removed } = removeBlock(blocks, fromId);
  if (!removed) return blocks;
  return insertBlock(tree, toId, removed, position);
}

// ─── Count ────────────────────────────────────────────────────────────────

/**
 * Count total blocks in the tree (including nested).
 */
export function countBlocks(blocks: Block[]): number {
  let count = 0;
  for (const b of blocks) {
    count++;
    if (b.children) count += countBlocks(b.children);
  }
  return count;
}

/**
 * Check if a block has visible children (not collapsed).
 */
export function hasVisibleChildren(block: Block): boolean {
  return !!(block.children && block.children.length > 0 && !block.collapsed);
}

/**
 * Get the depth of a block in the tree.
 */
export function getBlockDepth(blocks: Block[], id: string): number {
  function search(list: Block[], depth: number): number {
    for (const b of list) {
      if (b.id === id) return depth;
      if (b.children) {
        const found = search(b.children, depth + 1);
        if (found >= 0) return found;
      }
    }
    return -1;
  }
  return search(blocks, 0);
}

/**
 * Get the previous visible block in flat order (for focus navigation).
 */
export function getPreviousBlock(flat: FlatEntry[], currentId: string): FlatEntry | null {
  const idx = flat.findIndex(e => e.block.id === currentId);
  return idx > 0 ? flat[idx - 1] : null;
}

/**
 * Get the next visible block in flat order (for focus navigation).
 */
export function getNextBlock(flat: FlatEntry[], currentId: string): FlatEntry | null {
  const idx = flat.findIndex(e => e.block.id === currentId);
  return idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null;
}
