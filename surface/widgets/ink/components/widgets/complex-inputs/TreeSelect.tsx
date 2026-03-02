// ============================================================
// Clef Surface Ink Widget — TreeSelect
//
// Hierarchical tree with expand/collapse and checkbox selection
// for the terminal. Renders indented tree nodes with toggle
// indicators and selection checkboxes. Maps the
// tree-select.widget anatomy (root, item, itemToggle,
// itemCheckbox, itemLabel, itemChildren) and states (item,
// selection, focus) to keyboard-driven terminal rendering.
// ============================================================

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface TreeNode {
  /** Unique identifier. */
  id: string;
  /** Display label. */
  label: string;
  /** Optional children nodes. */
  children?: TreeNode[];
}

// --------------- Props ---------------

export interface TreeSelectProps {
  /** Selected value(s). Single string or array for multiple. */
  value?: string | string[];
  /** Tree data structure. */
  nodes?: TreeNode[];
  /** Whether multiple nodes can be selected. */
  multiple?: boolean;
  /** Initially expanded node IDs. */
  expanded?: string[];
  /** Disables the tree when true. */
  disabled?: boolean;
  /** Whether this component receives keyboard input. */
  isFocused?: boolean;
  /** Visible label. */
  label?: string;
  /** Called when selection changes. */
  onChange?: (value: string | string[]) => void;
}

// --------------- Helpers ---------------

interface FlatNode {
  node: TreeNode;
  depth: number;
  hasChildren: boolean;
  id: string;
}

const flattenTree = (
  nodes: TreeNode[],
  expandedSet: Set<string>,
  depth: number = 0,
): FlatNode[] => {
  const result: FlatNode[] = [];
  for (const node of nodes) {
    const hasChildren = !!node.children && node.children.length > 0;
    result.push({ node, depth, hasChildren, id: node.id });
    if (hasChildren && expandedSet.has(node.id)) {
      result.push(...flattenTree(node.children!, expandedSet, depth + 1));
    }
  }
  return result;
};

// --------------- Component ---------------

export const TreeSelect: React.FC<TreeSelectProps> = ({
  value: controlledValue,
  nodes = [],
  multiple = false,
  expanded: initialExpanded = [],
  disabled = false,
  isFocused = false,
  label,
  onChange,
}) => {
  const [expandedSet, setExpandedSet] = useState<Set<string>>(
    () => new Set(initialExpanded),
  );
  const [selectedSet, setSelectedSet] = useState<Set<string>>(() => {
    if (!controlledValue) return new Set();
    return new Set(Array.isArray(controlledValue) ? controlledValue : [controlledValue]);
  });
  const [focusIndex, setFocusIndex] = useState(0);

  useEffect(() => {
    if (controlledValue !== undefined) {
      setSelectedSet(
        new Set(Array.isArray(controlledValue) ? controlledValue : [controlledValue]),
      );
    }
  }, [controlledValue]);

  const flatNodes = useMemo(
    () => flattenTree(nodes, expandedSet),
    [nodes, expandedSet],
  );

  const emitChange = useCallback(
    (newSelected: Set<string>) => {
      const arr = Array.from(newSelected);
      if (multiple) {
        onChange?.(arr);
      } else {
        onChange?.(arr[0] ?? '');
      }
    },
    [multiple, onChange],
  );

  const toggleExpand = useCallback(
    (id: string) => {
      setExpandedSet((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    },
    [],
  );

  const toggleSelect = useCallback(
    (id: string) => {
      if (disabled) return;
      setSelectedSet((prev) => {
        const next = new Set(multiple ? prev : []);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        emitChange(next);
        return next;
      });
    },
    [disabled, multiple, emitChange],
  );

  useInput(
    (input, key) => {
      if (disabled || flatNodes.length === 0) return;

      // Navigate up/down
      if (key.upArrow) {
        setFocusIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (key.downArrow) {
        setFocusIndex((i) => Math.min(flatNodes.length - 1, i + 1));
        return;
      }

      const current = flatNodes[focusIndex];
      if (!current) return;

      // Expand/collapse with right/left
      if (key.rightArrow) {
        if (current.hasChildren && !expandedSet.has(current.id)) {
          toggleExpand(current.id);
        }
        return;
      }
      if (key.leftArrow) {
        if (current.hasChildren && expandedSet.has(current.id)) {
          toggleExpand(current.id);
        } else {
          // Move to parent (find the parent node)
          if (current.depth > 0) {
            for (let i = focusIndex - 1; i >= 0; i--) {
              if (flatNodes[i].depth < current.depth) {
                setFocusIndex(i);
                break;
              }
            }
          }
        }
        return;
      }

      // Toggle selection with space or enter
      if (input === ' ' || key.return) {
        toggleSelect(current.id);
        return;
      }
    },
    { isActive: isFocused },
  );

  // Clamp focus index if tree changes
  useEffect(() => {
    if (focusIndex >= flatNodes.length && flatNodes.length > 0) {
      setFocusIndex(flatNodes.length - 1);
    }
  }, [flatNodes.length, focusIndex]);

  return (
    <Box flexDirection="column">
      {label && <Text bold>{label}</Text>}

      {flatNodes.length === 0 ? (
        <Text dimColor>(empty tree)</Text>
      ) : (
        flatNodes.map((flat, idx) => {
          const isFocusedNode = idx === focusIndex && isFocused;
          const isSelected = selectedSet.has(flat.id);
          const indent = '  '.repeat(flat.depth);

          // Expand/collapse indicator
          let toggle = '  ';
          if (flat.hasChildren) {
            toggle = expandedSet.has(flat.id) ? '\u25BC ' : '\u25B6 ';
          }

          // Selection checkbox
          const checkbox = isSelected ? '[x]' : '[ ]';

          return (
            <Box key={flat.id}>
              <Text dimColor={disabled}>
                {indent}
              </Text>
              <Text color={flat.hasChildren ? 'cyan' : undefined} dimColor={disabled}>
                {toggle}
              </Text>
              <Text
                bold={isFocusedNode || isSelected}
                inverse={isFocusedNode && !disabled}
                dimColor={disabled}
                color={isSelected ? 'green' : undefined}
              >
                {checkbox} {flat.node.label}
              </Text>
            </Box>
          );
        })
      )}

      {/* Hint */}
      {isFocused && !disabled && flatNodes.length > 0 && (
        <Box marginTop={1}>
          <Text dimColor>
            {'\u2191\u2193'} navigate {'|'} {'\u2190\u2192'} collapse/expand {'|'} Space select
          </Text>
        </Box>
      )}
    </Box>
  );
};

TreeSelect.displayName = 'TreeSelect';
export default TreeSelect;
