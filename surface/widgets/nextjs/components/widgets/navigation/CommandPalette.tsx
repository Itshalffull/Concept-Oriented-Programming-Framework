'use client';

import {
  forwardRef,
  useReducer,
  useCallback,
  useRef,
  useEffect,
  useId,
  type ReactNode,
  type HTMLAttributes,
} from 'react';
import { useFocusReturn } from '../shared/useFocusReturn.js';
import { useScrollLock } from '../shared/useScrollLock.js';
import { paletteReducer, defaultFilter } from './CommandPalette.reducer.js';

// ---------------------------------------------------------------------------
// CommandPalette — Modal search overlay for rapid command execution.
// Keyboard-driven search, filter, and activation of commands/actions.
// Derived from command-palette.widget spec.
// ---------------------------------------------------------------------------

export interface CommandItem {
  id: string;
  label: string;
  icon?: ReactNode;
  shortcut?: string;
  group?: string;
  onSelect?: () => void;
  disabled?: boolean;
}

export interface CommandPaletteProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  open?: boolean;
  defaultOpen?: boolean;
  items: CommandItem[];
  placeholder?: string;
  emptyMessage?: string;
  closeOnSelect?: boolean;
  loop?: boolean;
  onOpenChange?: (open: boolean) => void;
  onQueryChange?: (query: string) => void;
  filterFn?: (item: CommandItem, query: string) => boolean;
  footer?: ReactNode;
  variant?: string;
  size?: string;
}

export const CommandPalette = forwardRef<HTMLDivElement, CommandPaletteProps>(
  function CommandPalette(
    {
      open: controlledOpen,
      defaultOpen = false,
      items,
      placeholder = 'Type a command...',
      emptyMessage = 'No results found.',
      closeOnSelect = true,
      loop = true,
      onOpenChange,
      onQueryChange,
      filterFn = defaultFilter,
      footer,
      variant,
      size,
      className,
      ...rest
    },
    ref
  ) {
    const id = useId();
    const inputId = `cmd-input-${id}`;
    const listId = `cmd-list-${id}`;
    const inputRef = useRef<HTMLInputElement>(null);

    const isControlled = controlledOpen !== undefined;
    const [state, dispatch] = useReducer(paletteReducer, {
      visibility: defaultOpen ? 'open' : 'closed',
      query: '',
      highlightedIndex: 0,
    });

    const isOpen = isControlled ? controlledOpen : state.visibility === 'open';

    useFocusReturn(isOpen);
    useScrollLock(isOpen);

    // Filter items
    const filteredItems = state.query
      ? items.filter((item) => filterFn(item, state.query))
      : items;

    const hasResults = filteredItems.length > 0;
    const resultsState = !state.query ? 'empty' : hasResults ? 'hasResults' : 'noResults';

    // Group items
    const groups = new Map<string, CommandItem[]>();
    for (const item of filteredItems) {
      const group = item.group ?? '';
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(item);
    }

    // Flat list for indexing
    const flatFiltered = filteredItems.filter((item) => !item.disabled);
    const highlightedItem = flatFiltered[state.highlightedIndex];

    const handleClose = useCallback(() => {
      if (!isControlled) dispatch({ type: 'CLOSE' });
      onOpenChange?.(false);
    }, [isControlled, onOpenChange]);

    const handleSelect = useCallback(
      (item: CommandItem) => {
        item.onSelect?.();
        if (closeOnSelect) {
          handleClose();
        }
      },
      [closeOnSelect, handleClose]
    );

    // Focus input when opened
    useEffect(() => {
      if (isOpen) {
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    }, [isOpen]);

    // Global Cmd+K / Ctrl+K listener
    useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
          e.preventDefault();
          if (!isControlled) dispatch({ type: 'OPEN' });
          onOpenChange?.(true);
        }
      };
      document.addEventListener('keydown', handler);
      return () => document.removeEventListener('keydown', handler);
    }, [isControlled, onOpenChange]);

    const handleInputChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value;
        dispatch({ type: 'INPUT', query });
        onQueryChange?.(query);
      },
      [onQueryChange]
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        const count = flatFiltered.length;
        switch (e.key) {
          case 'Escape':
            e.preventDefault();
            handleClose();
            break;
          case 'ArrowDown':
            e.preventDefault();
            dispatch({ type: 'NAVIGATE_NEXT', count, loop });
            break;
          case 'ArrowUp':
            e.preventDefault();
            dispatch({ type: 'NAVIGATE_PREV', count, loop });
            break;
          case 'Enter':
            e.preventDefault();
            if (highlightedItem) {
              handleSelect(highlightedItem);
            }
            break;
          default:
            break;
        }
      },
      [flatFiltered.length, loop, highlightedItem, handleClose, handleSelect]
    );

    if (!isOpen) return null;

    let flatIndex = 0;

    return (
      <div
        ref={ref}
        role="dialog"
        aria-label="Command palette"
        aria-modal="true"
        className={className}
        data-surface-widget=""
        data-widget-name="command-palette"
        data-part="root"
        data-state="open"
        data-variant={variant}
        data-size={size}
        {...rest}
      >
        <div
          data-part="backdrop"
          data-state="open"
          aria-hidden="true"
          onClick={handleClose}
        />
        <input
          ref={inputRef}
          id={inputId}
          role="combobox"
          aria-expanded={hasResults ? 'true' : 'false'}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            highlightedItem ? `cmd-item-${id}-${highlightedItem.id}` : undefined
          }
          placeholder={placeholder}
          data-part="input"
          value={state.query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        <div
          id={listId}
          role="listbox"
          aria-label="Results"
          data-part="list"
          data-state={resultsState}
        >
          {Array.from(groups.entries()).map(([groupName, groupItems]) => {
            if (groupName) {
              const groupLabelId = `cmd-group-label-${id}-${groupName}`;
              return (
                <div
                  key={groupName}
                  role="group"
                  aria-labelledby={groupLabelId}
                  data-part="group"
                >
                  <span
                    id={groupLabelId}
                    data-part="group-label"
                    aria-hidden="true"
                  >
                    {groupName}
                  </span>
                  {groupItems.map((item) => {
                    const currentIndex = flatIndex++;
                    const isHighlighted = currentIndex === state.highlightedIndex;
                    return (
                      <div
                        key={item.id}
                        id={`cmd-item-${id}-${item.id}`}
                        role="option"
                        aria-selected={isHighlighted ? 'true' : 'false'}
                        data-part="item"
                        data-highlighted={isHighlighted ? 'true' : 'false'}
                        tabIndex={-1}
                        onClick={() => {
                          if (!item.disabled) handleSelect(item);
                        }}
                        onPointerEnter={() =>
                          dispatch({ type: 'HIGHLIGHT', index: currentIndex })
                        }
                      >
                        {item.icon && (
                          <span aria-hidden="true" data-part="item-icon">
                            {item.icon}
                          </span>
                        )}
                        <span data-part="item-label">{item.label}</span>
                        {item.shortcut && (
                          <span aria-hidden="true" data-part="item-shortcut">
                            {item.shortcut}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            }
            return groupItems.map((item) => {
              const currentIndex = flatIndex++;
              const isHighlighted = currentIndex === state.highlightedIndex;
              return (
                <div
                  key={item.id}
                  id={`cmd-item-${id}-${item.id}`}
                  role="option"
                  aria-selected={isHighlighted ? 'true' : 'false'}
                  data-part="item"
                  data-highlighted={isHighlighted ? 'true' : 'false'}
                  tabIndex={-1}
                  onClick={() => {
                    if (!item.disabled) handleSelect(item);
                  }}
                  onPointerEnter={() =>
                    dispatch({ type: 'HIGHLIGHT', index: currentIndex })
                  }
                >
                  {item.icon && (
                    <span aria-hidden="true" data-part="item-icon">
                      {item.icon}
                    </span>
                  )}
                  <span data-part="item-label">{item.label}</span>
                  {item.shortcut && (
                    <span aria-hidden="true" data-part="item-shortcut">
                      {item.shortcut}
                    </span>
                  )}
                </div>
              );
            });
          })}
        </div>
        {resultsState === 'noResults' && (
          <div
            role="status"
            aria-live="polite"
            data-part="empty"
          >
            {emptyMessage}
          </div>
        )}
        {footer && <div data-part="footer">{footer}</div>}
      </div>
    );
  }
);

CommandPalette.displayName = 'CommandPalette';
export default CommandPalette;
