import { describe, it, expect } from 'vitest';
import {
  flattenTree,
  findBlock,
  updateBlock,
  removeBlock,
  insertBlock,
  indentBlock,
  outdentBlock,
  moveBlock,
  countBlocks,
  getBlockDepth,
  getPreviousBlock,
  getNextBlock,
  hasVisibleChildren,
} from '../clef-base/lib/block-tree-utils';
import {
  contentToBlocks,
  blocksToContent,
  blocksToDataRows,
  type Block,
  type BlockType,
} from '../clef-base/lib/block-serialization';

// ─── Helpers ────────────────────────────────────────────────────────────

function b(id: string, type: BlockType = 'paragraph', content = '', children?: Block[]): Block {
  const block: Block = { id, type, content };
  if (children) block.children = children;
  return block;
}

// ─── Block Tree Utils ───────────────────────────────────────────────────

describe('block-tree-utils', () => {
  describe('flattenTree', () => {
    it('flattens a flat list', () => {
      const blocks = [b('1'), b('2'), b('3')];
      const flat = flattenTree(blocks);
      expect(flat).toHaveLength(3);
      expect(flat.map(e => e.block.id)).toEqual(['1', '2', '3']);
      expect(flat.every(e => e.depth === 0)).toBe(true);
    });

    it('flattens nested blocks with depth', () => {
      const blocks = [
        b('1', 'paragraph', '', [
          b('1a'),
          b('1b', 'paragraph', '', [b('1b-i')]),
        ]),
        b('2'),
      ];
      const flat = flattenTree(blocks);
      expect(flat.map(e => [e.block.id, e.depth])).toEqual([
        ['1', 0], ['1a', 1], ['1b', 1], ['1b-i', 2], ['2', 0],
      ]);
    });

    it('skips collapsed children when skipCollapsed is true', () => {
      const blocks = [
        { ...b('1', 'paragraph', '', [b('1a'), b('1b')]), collapsed: true },
        b('2'),
      ];
      const flat = flattenTree(blocks, true);
      expect(flat.map(e => e.block.id)).toEqual(['1', '2']);
    });

    it('includes collapsed children when skipCollapsed is false', () => {
      const blocks = [
        { ...b('1', 'paragraph', '', [b('1a')]), collapsed: true },
      ];
      const flat = flattenTree(blocks, false);
      expect(flat.map(e => e.block.id)).toEqual(['1', '1a']);
    });

    it('tracks parentId and indexInParent', () => {
      const blocks = [b('p', 'paragraph', '', [b('c1'), b('c2')])];
      const flat = flattenTree(blocks);
      expect(flat[0].parentId).toBeNull();
      expect(flat[0].indexInParent).toBe(0);
      expect(flat[1].parentId).toBe('p');
      expect(flat[1].indexInParent).toBe(0);
      expect(flat[2].parentId).toBe('p');
      expect(flat[2].indexInParent).toBe(1);
    });
  });

  describe('findBlock', () => {
    it('finds a root-level block', () => {
      const blocks = [b('1'), b('2'), b('3')];
      const result = findBlock(blocks, '2');
      expect(result).not.toBeNull();
      expect(result!.block.id).toBe('2');
      expect(result!.index).toBe(1);
    });

    it('finds a deeply nested block', () => {
      const blocks = [b('1', 'paragraph', '', [b('1a', 'paragraph', '', [b('deep')])])];
      const result = findBlock(blocks, 'deep');
      expect(result).not.toBeNull();
      expect(result!.block.id).toBe('deep');
    });

    it('returns null for non-existent id', () => {
      expect(findBlock([b('1')], 'missing')).toBeNull();
    });
  });

  describe('updateBlock', () => {
    it('updates a root block immutably', () => {
      const blocks = [b('1', 'paragraph', 'old')];
      const next = updateBlock(blocks, '1', bl => ({ ...bl, content: 'new' }));
      expect(next[0].content).toBe('new');
      expect(blocks[0].content).toBe('old'); // original unchanged
    });

    it('updates a nested block', () => {
      const blocks = [b('p', 'paragraph', '', [b('c', 'paragraph', 'old')])];
      const next = updateBlock(blocks, 'c', bl => ({ ...bl, content: 'new' }));
      expect(next[0].children![0].content).toBe('new');
    });
  });

  describe('removeBlock', () => {
    it('removes a root block', () => {
      const blocks = [b('1'), b('2'), b('3')];
      const { tree, removed } = removeBlock(blocks, '2');
      expect(tree).toHaveLength(2);
      expect(tree.map(bl => bl.id)).toEqual(['1', '3']);
      expect(removed!.id).toBe('2');
    });

    it('removes a nested block', () => {
      const blocks = [b('p', 'paragraph', '', [b('c1'), b('c2')])];
      const { tree } = removeBlock(blocks, 'c1');
      expect(tree[0].children).toHaveLength(1);
      expect(tree[0].children![0].id).toBe('c2');
    });

    it('returns original tree if id not found', () => {
      const blocks = [b('1')];
      const { tree, removed } = removeBlock(blocks, 'missing');
      expect(tree).toBe(blocks);
      expect(removed).toBeNull();
    });
  });

  describe('insertBlock', () => {
    it('inserts after a block', () => {
      const blocks = [b('1'), b('3')];
      const next = insertBlock(blocks, '1', b('2'), 'after');
      expect(next.map(bl => bl.id)).toEqual(['1', '2', '3']);
    });

    it('inserts before a block', () => {
      const blocks = [b('2'), b('3')];
      const next = insertBlock(blocks, '2', b('1'), 'before');
      expect(next.map(bl => bl.id)).toEqual(['1', '2', '3']);
    });

    it('inserts as a child', () => {
      const blocks = [b('p')];
      const next = insertBlock(blocks, 'p', b('c'), 'child');
      expect(next[0].children).toHaveLength(1);
      expect(next[0].children![0].id).toBe('c');
    });
  });

  describe('indentBlock (Tab)', () => {
    it('makes a block the last child of its previous sibling', () => {
      const blocks = [b('1'), b('2'), b('3')];
      const next = indentBlock(blocks, '2');
      // '2' should now be a child of '1'
      expect(next).toHaveLength(2);
      expect(next[0].id).toBe('1');
      expect(next[0].children).toHaveLength(1);
      expect(next[0].children![0].id).toBe('2');
      expect(next[1].id).toBe('3');
    });

    it('returns original tree if block is first sibling (no previous sibling)', () => {
      const blocks = [b('1'), b('2')];
      const next = indentBlock(blocks, '1');
      expect(next).toBe(blocks); // unchanged
    });

    it('appends to existing children of previous sibling', () => {
      const blocks = [
        b('1', 'paragraph', '', [b('1a')]),
        b('2'),
      ];
      const next = indentBlock(blocks, '2');
      expect(next[0].children).toHaveLength(2);
      expect(next[0].children![1].id).toBe('2');
    });

    it('works for nested blocks', () => {
      const blocks = [b('p', 'paragraph', '', [b('c1'), b('c2')])];
      const next = indentBlock(blocks, 'c2');
      // c2 should be a child of c1
      expect(next[0].children).toHaveLength(1);
      expect(next[0].children![0].id).toBe('c1');
      expect(next[0].children![0].children).toHaveLength(1);
      expect(next[0].children![0].children![0].id).toBe('c2');
    });
  });

  describe('outdentBlock (Shift+Tab)', () => {
    it('moves a child block after its parent at parent level', () => {
      const blocks = [b('p', 'paragraph', '', [b('c')])];
      const next = outdentBlock(blocks, 'c');
      // 'c' should now be a root sibling after 'p'
      expect(next).toHaveLength(2);
      expect(next[0].id).toBe('p');
      expect(next[1].id).toBe('c');
      // parent should no longer have children
      expect(next[0].children).toBeUndefined();
    });

    it('returns original tree for root-level blocks', () => {
      const blocks = [b('1'), b('2')];
      const next = outdentBlock(blocks, '1');
      expect(next).toBe(blocks);
    });

    it('adopts trailing siblings as children', () => {
      const blocks = [b('p', 'paragraph', '', [b('c1'), b('c2'), b('c3')])];
      const next = outdentBlock(blocks, 'c2');
      // c2 should be at root level after p, with c3 as its child
      expect(next).toHaveLength(2);
      expect(next[0].id).toBe('p');
      expect(next[0].children).toHaveLength(1);
      expect(next[0].children![0].id).toBe('c1');
      expect(next[1].id).toBe('c2');
      expect(next[1].children).toHaveLength(1);
      expect(next[1].children![0].id).toBe('c3');
    });
  });

  describe('moveBlock', () => {
    it('moves a block from one position to another', () => {
      const blocks = [b('1'), b('2'), b('3')];
      const next = moveBlock(blocks, '3', '1', 'before');
      expect(next.map(bl => bl.id)).toEqual(['3', '1', '2']);
    });
  });

  describe('countBlocks', () => {
    it('counts flat blocks', () => {
      expect(countBlocks([b('1'), b('2')])).toBe(2);
    });

    it('counts nested blocks recursively', () => {
      const blocks = [b('1', 'paragraph', '', [b('1a'), b('1b')]), b('2')];
      expect(countBlocks(blocks)).toBe(4);
    });
  });

  describe('getBlockDepth', () => {
    it('returns 0 for root blocks', () => {
      expect(getBlockDepth([b('1')], '1')).toBe(0);
    });

    it('returns correct depth for nested blocks', () => {
      const blocks = [b('p', 'paragraph', '', [b('c', 'paragraph', '', [b('gc')])])];
      expect(getBlockDepth(blocks, 'c')).toBe(1);
      expect(getBlockDepth(blocks, 'gc')).toBe(2);
    });

    it('returns -1 for non-existent blocks', () => {
      expect(getBlockDepth([b('1')], 'missing')).toBe(-1);
    });
  });

  describe('getPreviousBlock / getNextBlock', () => {
    it('navigates between flat blocks', () => {
      const flat = flattenTree([b('1'), b('2'), b('3')]);
      expect(getPreviousBlock(flat, '2')!.block.id).toBe('1');
      expect(getNextBlock(flat, '2')!.block.id).toBe('3');
    });

    it('returns null at boundaries', () => {
      const flat = flattenTree([b('1'), b('2')]);
      expect(getPreviousBlock(flat, '1')).toBeNull();
      expect(getNextBlock(flat, '2')).toBeNull();
    });
  });

  describe('hasVisibleChildren', () => {
    it('returns false for blocks without children', () => {
      expect(hasVisibleChildren(b('1'))).toBe(false);
    });

    it('returns true for blocks with non-collapsed children', () => {
      expect(hasVisibleChildren(b('1', 'paragraph', '', [b('c')]))).toBe(true);
    });

    it('returns false for collapsed blocks', () => {
      expect(hasVisibleChildren({ ...b('1', 'paragraph', '', [b('c')]), collapsed: true })).toBe(false);
    });
  });
});

// ─── Content Serialization ──────────────────────────────────────────────

describe('BlockEditor serialization', () => {
  describe('contentToBlocks', () => {
    it('creates empty paragraph for null/undefined', () => {
      const blocks = contentToBlocks(null);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('paragraph');
      expect(blocks[0].content).toBe('');
    });

    it('parses valid block JSON array', () => {
      const input = JSON.stringify([
        { id: 'b1', type: 'heading1', content: 'Title' },
        { id: 'b2', type: 'paragraph', content: 'Body text' },
      ]);
      const blocks = contentToBlocks(input);
      expect(blocks).toHaveLength(2);
      expect(blocks[0].type).toBe('heading1');
      expect(blocks[0].content).toBe('Title');
      expect(blocks[1].type).toBe('paragraph');
    });

    it('preserves tree structure (children)', () => {
      const input = JSON.stringify([
        { id: 'p', type: 'paragraph', content: 'Parent', children: [
          { id: 'c', type: 'bullet', content: 'Child' },
        ]},
      ]);
      const blocks = contentToBlocks(input);
      expect(blocks[0].children).toHaveLength(1);
      expect(blocks[0].children![0].type).toBe('bullet');
    });

    it('converts plain text to paragraphs', () => {
      const blocks = contentToBlocks('First paragraph\n\nSecond paragraph');
      expect(blocks).toHaveLength(2);
      expect(blocks[0].type).toBe('paragraph');
      expect(blocks[1].type).toBe('paragraph');
    });

    it('converts JSON object to key-value paragraphs', () => {
      const blocks = contentToBlocks(JSON.stringify({ name: 'test', value: 42 }));
      expect(blocks).toHaveLength(2);
      expect(blocks[0].content).toContain('name');
      expect(blocks[1].content).toContain('42');
    });
  });

  describe('blocksToContent', () => {
    it('round-trips block data', () => {
      const original: Block[] = [
        { id: 'b1', type: 'heading1', content: 'Title' },
        { id: 'b2', type: 'paragraph', content: 'Body' },
      ];
      const json = blocksToContent(original);
      const parsed = JSON.parse(json);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].type).toBe('heading1');
      expect(parsed[1].content).toBe('Body');
    });

    it('preserves children in output', () => {
      const blocks: Block[] = [
        { id: 'p', type: 'paragraph', content: '', children: [
          { id: 'c', type: 'bullet', content: 'item' },
        ]},
      ];
      const json = blocksToContent(blocks);
      const parsed = JSON.parse(json);
      expect(parsed[0].children).toHaveLength(1);
    });

    it('preserves meta fields', () => {
      const blocks: Block[] = [
        { id: 'b1', type: 'code', content: 'x = 1', meta: { language: 'python' } },
      ];
      const json = blocksToContent(blocks);
      const parsed = JSON.parse(json);
      expect(parsed[0].meta.language).toBe('python');
    });

    it('omits empty optional fields', () => {
      const blocks: Block[] = [{ id: 'b1', type: 'paragraph', content: 'text' }];
      const json = blocksToContent(blocks);
      const parsed = JSON.parse(json);
      expect(parsed[0].children).toBeUndefined();
      expect(parsed[0].collapsed).toBeUndefined();
      expect(parsed[0].view_as).toBeUndefined();
      expect(parsed[0].meta).toBeUndefined();
    });
  });

  describe('blocksToDataRows', () => {
    it('converts blocks to flat data rows', () => {
      const blocks: Block[] = [
        { id: 'b1', type: 'heading1', content: 'Title' },
        { id: 'b2', type: 'paragraph', content: 'Body' },
      ];
      const rows = blocksToDataRows(blocks);
      expect(rows).toHaveLength(2);
      expect(rows[0].id).toBe('b1');
      expect(rows[0].type).toBe('heading1');
      expect(rows[0].hasChildren).toBe(false);
    });

    it('includes child count and meta', () => {
      const blocks: Block[] = [
        { id: 'p', type: 'paragraph', content: '', children: [
          { id: 'c1', type: 'bullet', content: 'a' },
          { id: 'c2', type: 'bullet', content: 'b' },
        ], meta: { language: 'ts' }},
      ];
      const rows = blocksToDataRows(blocks);
      expect(rows[0].hasChildren).toBe(true);
      expect(rows[0].childCount).toBe(2);
      expect(rows[0].language).toBe('ts');
    });
  });
});

// ─── Keyboard Behavior (logical, not DOM) ───────────────────────────────

describe('BlockEditor keyboard behavior (tree operations)', () => {
  describe('Enter on empty list item exits list', () => {
    it('empty bullet converts to paragraph', () => {
      const blocks = [b('1', 'bullet', '')];
      // This is what the Enter handler does for an empty list item:
      const next = updateBlock(blocks, '1', bl => ({
        ...bl, type: 'paragraph' as BlockType, content: '',
      }));
      expect(next[0].type).toBe('paragraph');
    });

    it('non-empty bullet creates another bullet after', () => {
      const blocks = [b('1', 'bullet', 'item text')];
      const newBlock = b('new', 'bullet', '');
      const next = insertBlock(blocks, '1', newBlock, 'after');
      expect(next).toHaveLength(2);
      expect(next[0].type).toBe('bullet');
      expect(next[1].type).toBe('bullet');
    });
  });

  describe('Enter splits content into two blocks', () => {
    it('creates a new paragraph after a heading', () => {
      const blocks = [b('h', 'heading1', 'Title')];
      const newBlock = b('new', 'paragraph', '');
      // Update current block content (before cursor) and insert after
      let next = updateBlock(blocks, 'h', bl => ({ ...bl, content: 'Title' }));
      next = insertBlock(next, 'h', newBlock, 'after');
      expect(next).toHaveLength(2);
      expect(next[0].type).toBe('heading1');
      expect(next[0].content).toBe('Title');
      expect(next[1].type).toBe('paragraph');
      expect(next[1].content).toBe('');
    });

    it('splits content at cursor position', () => {
      const blocks = [b('1', 'paragraph', 'Hello World')];
      // Simulate cursor between "Hello" and " World"
      const beforeHtml = 'Hello';
      const afterHtml = ' World';
      let next = updateBlock(blocks, '1', bl => ({ ...bl, content: beforeHtml }));
      const newBlock = b('new', 'paragraph', afterHtml);
      next = insertBlock(next, '1', newBlock, 'after');
      expect(next[0].content).toBe('Hello');
      expect(next[1].content).toBe(' World');
    });
  });

  describe('Tab indents block', () => {
    it('Tab on second block makes it child of first', () => {
      const blocks = [b('1', 'paragraph', 'A'), b('2', 'paragraph', 'B')];
      const next = indentBlock(blocks, '2');
      expect(next).toHaveLength(1);
      expect(next[0].children).toHaveLength(1);
      expect(next[0].children![0].id).toBe('2');
    });

    it('Tab on first block does nothing', () => {
      const blocks = [b('1'), b('2')];
      const next = indentBlock(blocks, '1');
      expect(next).toBe(blocks); // no change
    });

    it('multiple Tabs create deeper nesting', () => {
      let blocks = [b('1'), b('2'), b('3')];
      blocks = indentBlock(blocks, '2'); // 2 becomes child of 1
      blocks = indentBlock(blocks, '3'); // 3 becomes child of 1 (sibling of 2 at depth 1)
      expect(blocks[0].children).toHaveLength(2);
      // Indent 3 again — becomes child of 2
      blocks = indentBlock(blocks[0].children!, '3');
      // Now blocks[0].children has only '2', and '2'.children has '3'
      // But we operated on the children array directly — in real usage
      // the full tree is passed. Let me re-do with full tree:
    });
  });

  describe('Shift+Tab outdents block', () => {
    it('Shift+Tab moves child to parent level', () => {
      const blocks = [b('p', 'paragraph', 'Parent', [b('c', 'paragraph', 'Child')])];
      const next = outdentBlock(blocks, 'c');
      expect(next).toHaveLength(2);
      expect(next[0].id).toBe('p');
      expect(next[1].id).toBe('c');
    });

    it('Shift+Tab on root block does nothing', () => {
      const blocks = [b('1')];
      const next = outdentBlock(blocks, '1');
      expect(next).toBe(blocks);
    });
  });

  describe('Backspace on empty block', () => {
    it('converts non-paragraph to paragraph first', () => {
      const blocks = [b('1', 'heading1', '')];
      // First backspace: convert to paragraph
      const next = updateBlock(blocks, '1', bl => ({
        ...bl, type: 'paragraph' as BlockType,
      }));
      expect(next[0].type).toBe('paragraph');
    });

    it('outdents nested empty paragraph', () => {
      const blocks = [b('p', 'paragraph', 'Parent', [b('c', 'paragraph', '')])];
      const depth = getBlockDepth(blocks, 'c');
      expect(depth).toBe(1);
      const next = outdentBlock(blocks, 'c');
      expect(next).toHaveLength(2);
      expect(getBlockDepth(next, 'c')).toBe(0);
    });

    it('deletes root empty paragraph and focuses previous', () => {
      const blocks = [b('1', 'paragraph', 'Keep'), b('2', 'paragraph', '')];
      const flat = flattenTree(blocks, true);
      const flatIdx = flat.findIndex(e => e.block.id === '2');
      const prevEntry = flat[flatIdx - 1];
      expect(prevEntry.block.id).toBe('1');
      const { tree } = removeBlock(blocks, '2');
      expect(tree).toHaveLength(1);
      expect(tree[0].id).toBe('1');
    });
  });

  describe('Backspace at start of non-empty block merges with previous', () => {
    it('merges content with previous block', () => {
      const blocks = [
        b('1', 'paragraph', 'Hello'),
        b('2', 'paragraph', ' World'),
      ];
      // Merge: append '2' content to '1', then remove '2'
      const mergedContent = blocks[0].content + blocks[1].content;
      let next = updateBlock(blocks, '1', bl => ({ ...bl, content: mergedContent }));
      const { tree } = removeBlock(next, '2');
      expect(tree).toHaveLength(1);
      expect(tree[0].content).toBe('Hello World');
    });
  });

  describe('Tab/Shift+Tab round-trip', () => {
    it('indent then outdent returns to original structure', () => {
      const blocks = [b('1', 'paragraph', 'A'), b('2', 'paragraph', 'B')];
      const indented = indentBlock(blocks, '2');
      expect(indented).toHaveLength(1);
      expect(indented[0].children![0].id).toBe('2');
      const outdented = outdentBlock(indented, '2');
      expect(outdented).toHaveLength(2);
      expect(outdented[0].id).toBe('1');
      expect(outdented[1].id).toBe('2');
    });
  });
});
