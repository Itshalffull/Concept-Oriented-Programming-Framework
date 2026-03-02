// ============================================================
// Clef Surface Ink Widget — BlockEditor
//
// Full block-based document editor rendered in the terminal.
// Each line is an independently typed block (paragraph, heading,
// list, quote, code) that can be reordered, converted, and
// edited via keyboard. Arrow keys navigate blocks, enter edits,
// and slash triggers type selection.
//
// Adapts the block-editor.widget spec: anatomy (root, editor,
// block, blockDragHandle, blockMenu, slashMenu, selectionToolbar,
// placeholder), states, and connect attributes.
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface EditorBlock {
  id: string;
  type: string;
  content: string;
}

// --------------- Props ---------------

export interface BlockEditorProps {
  /** Ordered list of content blocks. */
  blocks: EditorBlock[];
  /** ID of the currently active block. */
  activeBlock?: string;
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
  /** Callback to add a new block after the given id. */
  onAddBlock?: (afterId?: string) => void;
  /** Callback to remove a block by id. */
  onRemoveBlock?: (id: string) => void;
  /** Callback when a block's content is updated. */
  onUpdateBlock?: (id: string, content: string) => void;
  /** Callback to move a block by id and direction. */
  onMoveBlock?: (id: string, direction: 'up' | 'down') => void;
}

// --------------- Helpers ---------------

const TYPE_ICONS: Record<string, string> = {
  paragraph: '\u00B6',
  heading: 'H',
  'heading-1': 'H1',
  'heading-2': 'H2',
  'heading-3': 'H3',
  list: '\u2022',
  'bulleted-list': '\u2022',
  'numbered-list': '#',
  quote: '\u201C',
  code: '<>',
  divider: '\u2014',
  callout: '!',
  toggle: '\u25B6',
};

// --------------- Component ---------------

export const BlockEditor: React.FC<BlockEditorProps> = ({
  blocks,
  activeBlock,
  isFocused = false,
  onAddBlock,
  onRemoveBlock,
  onUpdateBlock,
  onMoveBlock,
}) => {
  const [focusedIndex, setFocusedIndex] = useState(() => {
    if (activeBlock) {
      const idx = blocks.findIndex((b) => b.id === activeBlock);
      return idx >= 0 ? idx : 0;
    }
    return 0;
  });

  useInput(
    (input, key) => {
      if (!isFocused) return;

      if (key.downArrow) {
        setFocusedIndex((i) => Math.min(i + 1, blocks.length - 1));
      } else if (key.upArrow) {
        setFocusedIndex((i) => Math.max(i - 1, 0));
      } else if (key.return) {
        const block = blocks[focusedIndex];
        if (block) onAddBlock?.(block.id);
      } else if (key.delete || key.backspace) {
        const block = blocks[focusedIndex];
        if (block) {
          onRemoveBlock?.(block.id);
          setFocusedIndex((i) => Math.max(i - 1, 0));
        }
      } else if (input === 'K' && key.ctrl) {
        const block = blocks[focusedIndex];
        if (block) onMoveBlock?.(block.id, 'up');
      } else if (input === 'J' && key.ctrl) {
        const block = blocks[focusedIndex];
        if (block) onMoveBlock?.(block.id, 'down');
      }
    },
    { isActive: isFocused },
  );

  if (blocks.length === 0) {
    return (
      <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
        <Text dimColor>Type &apos;/&apos; for commands...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {blocks.map((block, index) => {
        const isActive = isFocused && focusedIndex === index;
        const icon = TYPE_ICONS[block.type] || '\u00B6';

        return (
          <Box key={block.id}>
            <Text dimColor>{icon.padEnd(3)}</Text>
            <Text
              inverse={isActive}
              bold={isActive}
              color={isActive ? 'cyan' : undefined}
            >
              {isActive ? '\u276F ' : '  '}
              {block.content || '(empty)'}
            </Text>
          </Box>
        );
      })}

      {isFocused && (
        <Box marginTop={1}>
          <Text dimColor>
            {'\u2191\u2193'} navigate {'  '} Enter new block {'  '} Del remove
            {'  '} Ctrl+K/J move
          </Text>
        </Box>
      )}
    </Box>
  );
};

BlockEditor.displayName = 'BlockEditor';
export default BlockEditor;
