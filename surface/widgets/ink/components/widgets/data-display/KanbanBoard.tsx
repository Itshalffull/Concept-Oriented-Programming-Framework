// ============================================================
// Clef Surface Ink Widget — KanbanBoard
//
// Column-based board for organising items into categorical lanes.
// Each column represents a status or grouping with cards that
// can be navigated and moved between columns via keyboard.
// Terminal adaptation: side-by-side bordered columns with items
// listed, arrow keys navigate between columns and items.
// See widget spec: repertoire/widgets/data-display/kanban-board.widget
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface KanbanItem {
  id: string;
  title: string;
  description?: string;
}

export interface KanbanColumn {
  id: string;
  title: string;
  items: KanbanItem[];
}

// --------------- Props ---------------

export interface KanbanBoardProps {
  /** Columns with their items. */
  columns: KanbanColumn[];
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
  /** Callback when an item is moved between columns. */
  onMoveItem?: (itemId: string, fromColumnId: string, toColumnId: string) => void;
}

// --------------- Component ---------------

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  columns,
  isFocused = false,
  onMoveItem,
}) => {
  const [focusColIndex, setFocusColIndex] = useState(0);
  const [focusItemIndex, setFocusItemIndex] = useState(0);

  const currentColumn = columns[focusColIndex];
  const currentItems = currentColumn?.items ?? [];

  const moveItem = useCallback(
    (direction: 'left' | 'right') => {
      if (!currentColumn || currentItems.length === 0) return;

      const item = currentItems[focusItemIndex];
      if (!item) return;

      const targetColIndex =
        direction === 'left'
          ? Math.max(0, focusColIndex - 1)
          : Math.min(columns.length - 1, focusColIndex + 1);

      if (targetColIndex === focusColIndex) return;

      const targetColumn = columns[targetColIndex];
      if (targetColumn) {
        onMoveItem?.(item.id, currentColumn.id, targetColumn.id);
        setFocusColIndex(targetColIndex);
        setFocusItemIndex(0);
      }
    },
    [columns, focusColIndex, focusItemIndex, currentColumn, currentItems, onMoveItem],
  );

  useInput(
    (input, key) => {
      if (!isFocused || columns.length === 0) return;

      if (key.leftArrow) {
        setFocusColIndex((c) => Math.max(0, c - 1));
        setFocusItemIndex(0);
      } else if (key.rightArrow) {
        setFocusColIndex((c) => Math.min(columns.length - 1, c + 1));
        setFocusItemIndex(0);
      } else if (key.upArrow) {
        setFocusItemIndex((i) => Math.max(0, i - 1));
      } else if (key.downArrow) {
        setFocusItemIndex((i) => Math.min(currentItems.length - 1, i + 1));
      } else if (input === 'h' || input === 'H') {
        moveItem('left');
      } else if (input === 'l' || input === 'L') {
        moveItem('right');
      }
    },
    { isActive: isFocused },
  );

  if (columns.length === 0) {
    return <Text dimColor>No columns</Text>;
  }

  return (
    <Box flexDirection="row">
      {columns.map((col, ci) => {
        const isColFocused = isFocused && ci === focusColIndex;

        return (
          <Box
            key={col.id}
            flexDirection="column"
            borderStyle="single"
            borderColor={isColFocused ? 'cyan' : undefined}
            paddingX={1}
            minWidth={20}
            marginRight={ci < columns.length - 1 ? 1 : 0}
          >
            {/* Column header */}
            <Box>
              <Text bold color={isColFocused ? 'cyan' : undefined}>
                {col.title}
              </Text>
              <Box flexGrow={1} />
              <Text dimColor>({col.items.length})</Text>
            </Box>
            <Text dimColor>{'\u2500'.repeat(18)}</Text>

            {/* Items */}
            {col.items.length === 0 ? (
              <Text dimColor>  (empty)</Text>
            ) : (
              col.items.map((item, ii) => {
                const isItemFocused = isColFocused && ii === focusItemIndex;

                return (
                  <Box key={item.id} marginBottom={0}>
                    <Text
                      color={isItemFocused ? 'cyan' : undefined}
                      inverse={isItemFocused}
                    >
                      {isItemFocused ? '\u276F ' : '  '}
                      {item.title}
                    </Text>
                  </Box>
                );
              })
            )}

            {/* Move hint */}
            {isColFocused && currentItems.length > 0 && (
              <Box marginTop={1}>
                <Text dimColor>[h/l] move item</Text>
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
};

KanbanBoard.displayName = 'KanbanBoard';
export default KanbanBoard;
