'use client';
import {
  forwardRef,
  useReducer,
  useCallback,
  useRef,
  useId,
  type ReactNode,
  type KeyboardEvent,
} from 'react';
import { createListReducer } from './List.reducer.js';

// Props from list.widget spec
export interface ListItem {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  action?: { label: string; onClick: () => void };
}

export interface ListProps {
  items: ListItem[];
  selectable?: boolean;
  multiSelect?: boolean;
  dividers?: boolean;
  ariaLabel?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  selectedIds?: string[];
  onSelect?: (id: string) => void;
  onDeselect?: (id: string) => void;
  onItemAction?: (id: string) => void;
  className?: string;
  children?: ReactNode;
}

export const List = forwardRef<HTMLDivElement, ListProps>(
  function List(
    {
      items,
      selectable = false,
      multiSelect = false,
      dividers = true,
      ariaLabel,
      disabled = false,
      size = 'md',
      selectedIds: controlledSelectedIds,
      onSelect,
      onDeselect,
      onItemAction,
      className,
      children,
    },
    ref
  ) {
    const reducer = createListReducer(items.length, multiSelect);
    const [state, dispatch] = useReducer(reducer, {
      focusedIndex: 0,
      selectedIds: new Set(controlledSelectedIds ?? []),
    });
    const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
    const baseId = useId();

    const selectedSet = controlledSelectedIds
      ? new Set(controlledSelectedIds)
      : state.selectedIds;

    const handleItemSelect = useCallback(
      (id: string) => {
        if (!selectable || disabled) return;
        dispatch({ type: 'SELECT', id });
        if (selectedSet.has(id)) {
          onDeselect?.(id);
        } else {
          onSelect?.(id);
        }
      },
      [selectable, disabled, selectedSet, onSelect, onDeselect]
    );

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLDivElement>, index: number) => {
        switch (e.key) {
          case 'ArrowUp':
            e.preventDefault();
            dispatch({ type: 'NAVIGATE_PREV' });
            itemRefs.current[Math.max(0, index - 1)]?.focus();
            break;
          case 'ArrowDown':
            e.preventDefault();
            dispatch({ type: 'NAVIGATE_NEXT' });
            itemRefs.current[Math.min(items.length - 1, index + 1)]?.focus();
            break;
          case 'Home':
            e.preventDefault();
            dispatch({ type: 'NAVIGATE_FIRST' });
            itemRefs.current[0]?.focus();
            break;
          case 'End':
            e.preventDefault();
            dispatch({ type: 'NAVIGATE_LAST' });
            itemRefs.current[items.length - 1]?.focus();
            break;
          case 'Enter':
          case ' ':
            if (selectable) {
              e.preventDefault();
              handleItemSelect(items[index].id);
            }
            break;
        }
      },
      [items, selectable, handleItemSelect]
    );

    return (
      <div
        ref={ref}
        className={className}
        role={selectable ? 'listbox' : 'list'}
        aria-label={ariaLabel}
        aria-multiselectable={multiSelect ? 'true' : undefined}
        data-surface-widget=""
        data-widget-name="list"
        data-part="root"
        data-selectable={selectable ? 'true' : 'false'}
        data-dividers={dividers ? 'true' : 'false'}
        data-size={size}
      >
        {items.map((item, index) => {
          const isSelected = selectedSet.has(item.id);
          const isFocused = state.focusedIndex === index;
          const labelId = `${baseId}-label-${index}`;
          const descId = `${baseId}-desc-${index}`;

          return (
            <div key={item.id}>
              <div
                ref={(el) => { itemRefs.current[index] = el; }}
                role={selectable ? 'option' : 'listitem'}
                aria-selected={selectable ? (isSelected ? 'true' : 'false') : undefined}
                aria-disabled={disabled ? 'true' : 'false'}
                tabIndex={isFocused ? 0 : -1}
                data-state={isSelected ? 'selected' : isFocused ? 'focused' : 'idle'}
                onClick={() => handleItemSelect(item.id)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                onMouseEnter={() => dispatch({ type: 'FOCUS', index })}
                onFocus={() => dispatch({ type: 'FOCUS', index })}
                onBlur={() => dispatch({ type: 'BLUR' })}
              >
                {item.icon && (
                  <span data-part="item-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                )}
                <span id={labelId} data-part="item-label">
                  {item.label}
                </span>
                {item.description && (
                  <span id={descId} data-part="item-description">
                    {item.description}
                  </span>
                )}
                {item.action && (
                  <button
                    type="button"
                    data-part="item-action"
                    role="button"
                    tabIndex={0}
                    aria-label={item.action.label}
                    onClick={(e) => {
                      e.stopPropagation();
                      item.action!.onClick();
                      onItemAction?.(item.id);
                    }}
                  >
                    {item.action.label}
                  </button>
                )}
              </div>
              {dividers && index < items.length - 1 && (
                <div
                  role="separator"
                  aria-hidden="true"
                  data-part="divider"
                  data-visible="true"
                />
              )}
            </div>
          );
        })}
        {children}
      </div>
    );
  }
);

List.displayName = 'List';
export default List;
