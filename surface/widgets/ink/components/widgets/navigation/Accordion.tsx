// ============================================================
// Clef Surface Ink Widget — Accordion
//
// Vertically stacked collapsible sections for terminal.
// Each section has a trigger heading and expandable content
// panel. Supports single or multiple expanded sections.
// Maps accordion.widget anatomy (root, item, trigger,
// indicator, content) to Ink Box/Text with useInput navigation.
// See Architecture doc Section 16.
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface AccordionItem {
  id: string;
  title: string;
  content: string;
}

// --------------- Props ---------------

export interface AccordionProps {
  /** Array of collapsible sections. */
  items: AccordionItem[];
  /** Allow multiple sections open simultaneously. */
  multiple?: boolean;
  /** IDs of initially expanded sections. */
  defaultOpen?: string[];
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
  /** Callback when expanded sections change. */
  onChange?: (openIds: string[]) => void;
}

// --------------- Component ---------------

export const Accordion: React.FC<AccordionProps> = ({
  items,
  multiple = false,
  defaultOpen = [],
  isFocused = false,
  onChange,
}) => {
  const [openIds, setOpenIds] = useState<string[]>(defaultOpen);
  const [focusIndex, setFocusIndex] = useState(0);

  const toggle = useCallback(
    (id: string) => {
      setOpenIds((prev) => {
        const isOpen = prev.includes(id);
        let next: string[];
        if (isOpen) {
          next = prev.filter((v) => v !== id);
        } else {
          next = multiple ? [...prev, id] : [id];
        }
        onChange?.(next);
        return next;
      });
    },
    [multiple, onChange],
  );

  useInput(
    (input, key) => {
      if (!isFocused || items.length === 0) return;

      if (key.downArrow) {
        setFocusIndex((i) => Math.min(i + 1, items.length - 1));
      } else if (key.upArrow) {
        setFocusIndex((i) => Math.max(i - 1, 0));
      } else if (key.return || input === ' ') {
        const item = items[focusIndex];
        if (item) toggle(item.id);
      }
    },
    { isActive: isFocused },
  );

  return (
    <Box flexDirection="column">
      {items.map((item, index) => {
        const isOpen = openIds.includes(item.id);
        const isFocusedItem = isFocused && index === focusIndex;

        return (
          <Box key={item.id} flexDirection="column">
            <Box>
              <Text color={isFocusedItem ? 'cyan' : undefined}>
                {isOpen ? '\u25BC' : '\u25B6'}{' '}
              </Text>
              <Text bold={isFocusedItem} color={isFocusedItem ? 'cyan' : undefined}>
                {item.title}
              </Text>
            </Box>
            {isOpen && (
              <Box marginLeft={2} marginBottom={1}>
                <Text>{item.content}</Text>
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
};

Accordion.displayName = 'Accordion';
export default Accordion;
