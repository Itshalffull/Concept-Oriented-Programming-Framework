'use client';

import {
  forwardRef,
  useCallback,
  useReducer,
  useRef,
  type HTMLAttributes,
  type KeyboardEvent,
} from 'react';
import { treeReducer, getAllDescendantIds, type TreeNode } from './TreeSelect.reducer.js';
export type { TreeNode } from './TreeSelect.reducer.js';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface TreeSelectProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Tree data. */
  items: TreeNode[];
  /** Enable selection checkboxes. */
  selectable?: boolean;
  /** Allow multiple selection. */
  multiSelect?: boolean;
  /** IDs of initially expanded nodes. */
  defaultExpanded?: string[];
  /** Accessible label. */
  label?: string;
  /** Disabled state. */
  disabled?: boolean;
  /** Controlled selected IDs. */
  value?: string[];
  /** Size variant. */
  size?: 'sm' | 'md' | 'lg';
  /** Callback when selection changes. */
  onChange?: (selectedIds: string[]) => void;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const TreeSelect = forwardRef<HTMLDivElement, TreeSelectProps>(function TreeSelect(
  {
    items,
    selectable = true,
    multiSelect = true,
    defaultExpanded = [],
    label = 'Tree',
    disabled = false,
    value,
    size = 'md',
    onChange,
    ...rest
  },
  ref,
) {
  const [machine, send] = useReducer(treeReducer, {
    expandedIds: new Set(defaultExpanded),
    checkedIds: new Set(value ?? []),
    focusedId: null,
  });

  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Flatten visible items for keyboard navigation
  const getVisibleItems = useCallback((): string[] => {
    const visible: string[] = [];
    const walk = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        visible.push(node.id);
        if (node.children && machine.expandedIds.has(node.id)) {
          walk(node.children);
        }
      }
    };
    walk(items);
    return visible;
  }, [items, machine.expandedIds]);

  const focusItem = useCallback(
    (id: string) => {
      send({ type: 'FOCUS_ITEM', itemId: id });
      const el = itemRefs.current.get(id);
      el?.focus();
    },
    [],
  );

  const getSelectionState = useCallback(
    (node: TreeNode): 'checked' | 'unchecked' | 'indeterminate' => {
      if (!node.children || node.children.length === 0) {
        return machine.checkedIds.has(node.id) ? 'checked' : 'unchecked';
      }
      const descendants = getAllDescendantIds(node);
      const checkedCount = descendants.filter((id) => machine.checkedIds.has(id)).length;
      if (checkedCount === 0 && !machine.checkedIds.has(node.id)) return 'unchecked';
      if (checkedCount === descendants.length) return 'checked';
      return 'indeterminate';
    },
    [machine.checkedIds],
  );

  const toggleCheck = useCallback(
    (node: TreeNode) => {
      if (disabled || node.disabled) return;
      const currentState = getSelectionState(node);
      const newChecked = new Set(machine.checkedIds);

      if (currentState === 'checked') {
        newChecked.delete(node.id);
        for (const id of getAllDescendantIds(node)) newChecked.delete(id);
      } else {
        newChecked.add(node.id);
        for (const id of getAllDescendantIds(node)) newChecked.add(id);
      }

      // We dispatch individual events for the main node
      if (currentState === 'checked') {
        send({ type: 'UNCHECK', itemId: node.id });
      } else {
        send({ type: 'CHECK', itemId: node.id });
      }

      // Also update descendants via toggle
      for (const id of getAllDescendantIds(node)) {
        if (currentState === 'checked') send({ type: 'UNCHECK', itemId: id });
        else send({ type: 'CHECK', itemId: id });
      }

      onChange?.(Array.from(newChecked));
    },
    [disabled, getSelectionState, machine.checkedIds, onChange],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent, node: TreeNode, depth: number) => {
      const visibleItems = getVisibleItems();
      const currentIndex = visibleItems.indexOf(node.id);

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          if (currentIndex < visibleItems.length - 1) focusItem(visibleItems[currentIndex + 1]);
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          if (currentIndex > 0) focusItem(visibleItems[currentIndex - 1]);
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          if (node.children && !machine.expandedIds.has(node.id)) {
            send({ type: 'EXPAND', itemId: node.id });
          } else if (node.children && machine.expandedIds.has(node.id) && node.children.length > 0) {
            focusItem(node.children[0].id);
          }
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          if (node.children && machine.expandedIds.has(node.id)) {
            send({ type: 'COLLAPSE', itemId: node.id });
          }
          // Otherwise focus parent (would need parent tracking)
          break;
        }
        case 'Home': {
          e.preventDefault();
          if (visibleItems.length > 0) focusItem(visibleItems[0]);
          break;
        }
        case 'End': {
          e.preventDefault();
          if (visibleItems.length > 0) focusItem(visibleItems[visibleItems.length - 1]);
          break;
        }
        case ' ': {
          e.preventDefault();
          if (selectable) toggleCheck(node);
          break;
        }
        case 'Enter': {
          e.preventDefault();
          if (node.children) send({ type: 'TOGGLE', itemId: node.id });
          break;
        }
        case '*': {
          e.preventDefault();
          // Expand all siblings at this level - simplified: expand all at same depth
          for (const item of items) {
            if (item.children) send({ type: 'EXPAND', itemId: item.id });
          }
          break;
        }
      }
    },
    [getVisibleItems, focusItem, machine.expandedIds, items, selectable, toggleCheck],
  );

  // Render a single tree item recursively
  const renderItem = (node: TreeNode, depth: number, siblings: TreeNode[], posInSet: number) => {
    const hasChildren = !!(node.children && node.children.length > 0);
    const isExpanded = machine.expandedIds.has(node.id);
    const isFocused = machine.focusedId === node.id;
    const selState = selectable ? getSelectionState(node) : 'unchecked';
    const isChecked = selState === 'checked';
    const isIndeterminate = selState === 'indeterminate';

    return (
      <div key={node.id} data-part="item-wrapper">
        <div
          ref={(el) => { if (el) itemRefs.current.set(node.id, el); }}
          role="treeitem"
          aria-expanded={hasChildren ? (isExpanded ? 'true' : 'false') : undefined}
          aria-selected={selectable ? (isChecked ? 'true' : 'false') : undefined}
          aria-checked={selectable && multiSelect ? (isChecked ? 'true' : isIndeterminate ? 'mixed' : 'false') : undefined}
          aria-level={depth + 1}
          aria-setsize={siblings.length}
          aria-posinset={posInSet + 1}
          aria-disabled={node.disabled || disabled ? 'true' : 'false'}
          data-part="item"
          data-state={isExpanded ? 'expanded' : 'collapsed'}
          data-selected={isChecked ? 'true' : 'false'}
          data-indeterminate={isIndeterminate ? 'true' : 'false'}
          data-depth={depth + 1}
          data-has-children={hasChildren ? 'true' : 'false'}
          tabIndex={isFocused ? 0 : -1}
          onFocus={() => send({ type: 'FOCUS_ITEM', itemId: node.id })}
          onBlur={() => send({ type: 'BLUR' })}
          onKeyDown={(e) => handleKeyDown(e, node, depth)}
        >
          {/* Toggle */}
          <span
            data-part="item-toggle"
            data-state={isExpanded ? 'expanded' : 'collapsed'}
            data-visible={hasChildren ? 'true' : 'false'}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
            aria-hidden={!hasChildren ? 'true' : 'false'}
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              if (hasChildren) send({ type: 'TOGGLE', itemId: node.id });
            }}
          >
            {hasChildren ? (isExpanded ? '\u25BE' : '\u25B8') : ''}
          </span>

          {/* Checkbox */}
          {selectable && (
            <input
              type="checkbox"
              data-part="item-checkbox"
              data-visible="true"
              checked={isChecked}
              ref={(el) => { if (el) el.indeterminate = isIndeterminate; }}
              disabled={node.disabled || disabled}
              aria-label={`Select ${node.label}`}
              tabIndex={-1}
              onChange={() => toggleCheck(node)}
              onClick={(e) => e.stopPropagation()}
            />
          )}

          {/* Label */}
          <span
            data-part="item-label"
            data-selected={isChecked ? 'true' : 'false'}
            data-disabled={node.disabled || disabled ? 'true' : 'false'}
          >
            {node.label}
          </span>
        </div>

        {/* Children */}
        {hasChildren && (
          <div
            role="group"
            data-part="item-children"
            data-state={isExpanded ? 'expanded' : 'collapsed'}
            data-visible={isExpanded ? 'true' : 'false'}
            aria-hidden={!isExpanded ? 'true' : 'false'}
          >
            {isExpanded && node.children!.map((child, idx) =>
              renderItem(child, depth + 1, node.children!, idx),
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      ref={ref}
      role="tree"
      aria-label={label}
      aria-multiselectable={multiSelect ? 'true' : 'false'}
      data-part="root"
      data-disabled={disabled ? 'true' : 'false'}
      data-size={size}
      data-surface-widget=""
      data-widget-name="tree-select"
      {...rest}
    >
      {items.map((item, idx) => renderItem(item, 0, items, idx))}
    </div>
  );
});

TreeSelect.displayName = 'TreeSelect';
export { TreeSelect };
export default TreeSelect;
