'use client';

import {
  forwardRef,
  useReducer,
  useCallback,
  useRef,
  useEffect,
  useId,
  useState,
  type ReactNode,
  type HTMLAttributes,
} from 'react';
import { useRovingFocus } from '../shared/useRovingFocus.js';
import { useOutsideClick } from '../shared/useOutsideClick.js';
import { menuReducer, type MenuState } from './Menu.reducer.js';

// ---------------------------------------------------------------------------
// Menu — Dropdown command menu with keyboard navigation.
// Supports items, separators, groups, and nested submenus.
// Derived from menu.widget spec.
// ---------------------------------------------------------------------------

export interface MenuItem {
  type: 'item' | 'separator' | 'group';
  label?: string;
  icon?: ReactNode;
  shortcut?: string;
  disabled?: boolean;
  onSelect?: () => void;
  items?: MenuItem[];
  groupLabel?: string;
}

export interface MenuProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  trigger: ReactNode;
  items: MenuItem[];
  open?: boolean;
  defaultOpen?: boolean;
  placement?: string;
  closeOnSelect?: boolean;
  loop?: boolean;
  typeahead?: boolean;
  onOpenChange?: (open: boolean) => void;
  variant?: string;
  size?: string;
}

export const Menu = forwardRef<HTMLDivElement, MenuProps>(
  function Menu(
    {
      trigger,
      items,
      open: controlledOpen,
      defaultOpen = false,
      placement = 'bottom-start',
      closeOnSelect = true,
      loop = false,
      typeahead = true,
      onOpenChange,
      variant,
      size,
      className,
      ...rest
    },
    ref
  ) {
    const id = useId();
    const triggerId = `menu-trigger-${id}`;
    const contentId = `menu-content-${id}`;
    const rootRef = useRef<HTMLDivElement | null>(null);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const contentRef = useRef<HTMLDivElement | null>(null);

    const isControlled = controlledOpen !== undefined;
    const [internalState, dispatch] = useReducer(menuReducer, defaultOpen ? 'open' : 'closed');
    const currentState: MenuState = isControlled
      ? (controlledOpen ? 'open' : 'closed')
      : internalState;

    const isOpen = currentState === 'open';
    const dataState = isOpen ? 'open' : 'closed';

    const [highlightedIndex, setHighlightedIndex] = useState(-1);

    // Flatten actionable items for roving focus
    const flatItems = items.filter((item) => item.type === 'item' && !item.disabled);

    const { getItemProps } = useRovingFocus({
      orientation: 'vertical',
      loop,
    });

    const handleOpen = useCallback(() => {
      if (!isControlled) dispatch({ type: 'OPEN' });
      onOpenChange?.(true);
    }, [isControlled, onOpenChange]);

    const handleClose = useCallback(() => {
      if (!isControlled) dispatch({ type: 'CLOSE' });
      onOpenChange?.(false);
      triggerRef.current?.focus();
    }, [isControlled, onOpenChange]);

    const handleToggle = useCallback(() => {
      if (isOpen) handleClose();
      else handleOpen();
    }, [isOpen, handleClose, handleOpen]);

    const handleSelect = useCallback(
      (item: MenuItem) => {
        item.onSelect?.();
        if (closeOnSelect) {
          handleClose();
        }
      },
      [closeOnSelect, handleClose]
    );

    useOutsideClick(rootRef, () => {
      if (isOpen) handleClose();
    }, isOpen);

    // Focus first item when menu opens
    useEffect(() => {
      if (isOpen && contentRef.current) {
        const firstItem = contentRef.current.querySelector('[role="menuitem"]') as HTMLElement | null;
        firstItem?.focus();
        setHighlightedIndex(0);
      }
    }, [isOpen]);

    const handleTriggerKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleOpen();
        }
      },
      [handleOpen]
    );

    const handleContentKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        const count = flatItems.length;
        if (count === 0) return;

        switch (e.key) {
          case 'ArrowDown': {
            e.preventDefault();
            const next = loop
              ? (highlightedIndex + 1) % count
              : Math.min(highlightedIndex + 1, count - 1);
            setHighlightedIndex(next);
            const items = contentRef.current?.querySelectorAll('[role="menuitem"]');
            (items?.[next] as HTMLElement)?.focus();
            break;
          }
          case 'ArrowUp': {
            e.preventDefault();
            const prev = loop
              ? (highlightedIndex - 1 + count) % count
              : Math.max(highlightedIndex - 1, 0);
            setHighlightedIndex(prev);
            const items = contentRef.current?.querySelectorAll('[role="menuitem"]');
            (items?.[prev] as HTMLElement)?.focus();
            break;
          }
          case 'Home':
            e.preventDefault();
            setHighlightedIndex(0);
            (contentRef.current?.querySelectorAll('[role="menuitem"]')?.[0] as HTMLElement)?.focus();
            break;
          case 'End':
            e.preventDefault();
            setHighlightedIndex(count - 1);
            (contentRef.current?.querySelectorAll('[role="menuitem"]')?.[count - 1] as HTMLElement)?.focus();
            break;
          case 'Escape':
            e.preventDefault();
            handleClose();
            break;
          case 'Enter':
          case ' ':
            e.preventDefault();
            if (highlightedIndex >= 0 && highlightedIndex < flatItems.length) {
              handleSelect(flatItems[highlightedIndex]);
            }
            break;
          default:
            // Typeahead: match first character of item labels
            if (typeahead && e.key.length === 1) {
              const char = e.key.toLowerCase();
              const matchIndex = flatItems.findIndex(
                (item, idx) =>
                  idx > highlightedIndex &&
                  item.label?.toLowerCase().startsWith(char)
              );
              const fallbackIndex = flatItems.findIndex((item) =>
                item.label?.toLowerCase().startsWith(char)
              );
              const target = matchIndex >= 0 ? matchIndex : fallbackIndex;
              if (target >= 0) {
                setHighlightedIndex(target);
                const items = contentRef.current?.querySelectorAll('[role="menuitem"]');
                (items?.[target] as HTMLElement)?.focus();
              }
            }
            break;
        }
      },
      [flatItems, highlightedIndex, loop, typeahead, handleClose, handleSelect]
    );

    let flatIndex = 0;

    const renderItems = (menuItems: MenuItem[]) =>
      menuItems.map((item, i) => {
        if (item.type === 'separator') {
          return (
            <div
              key={`sep-${i}`}
              role="separator"
              aria-hidden="true"
              data-part="separator"
            />
          );
        }

        if (item.type === 'group' && item.items) {
          return (
            <div
              key={`group-${i}`}
              role="group"
              aria-labelledby={`menu-group-label-${id}-${i}`}
              data-part="group"
            >
              {item.groupLabel && (
                <span
                  id={`menu-group-label-${id}-${i}`}
                  data-part="group-label"
                >
                  {item.groupLabel}
                </span>
              )}
              {renderItems(item.items)}
            </div>
          );
        }

        const currentFlatIndex = flatIndex++;
        const isHighlighted = currentFlatIndex === highlightedIndex;

        return (
          <div
            key={`item-${i}`}
            role="menuitem"
            tabIndex={-1}
            data-part="item"
            data-highlighted={isHighlighted ? 'true' : 'false'}
            data-disabled={item.disabled ? 'true' : 'false'}
            aria-disabled={item.disabled ? 'true' : undefined}
            onClick={() => {
              if (!item.disabled) handleSelect(item);
            }}
            onPointerEnter={() => setHighlightedIndex(currentFlatIndex)}
            onPointerLeave={() => setHighlightedIndex(-1)}
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

    return (
      <div
        ref={(node) => {
          rootRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        className={className}
        data-surface-widget=""
        data-widget-name="menu"
        data-part="root"
        data-state={dataState}
        data-variant={variant}
        data-size={size}
        {...rest}
      >
        <button
          ref={triggerRef}
          id={triggerId}
          type="button"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-controls={contentId}
          data-part="trigger"
          data-state={dataState}
          onClick={handleToggle}
          onKeyDown={handleTriggerKeyDown}
        >
          {trigger}
        </button>
        {isOpen && (
          <div
            data-part="positioner"
            data-placement={placement}
            data-state={dataState}
            style={{ position: 'absolute' }}
          >
            <div
              ref={contentRef}
              id={contentId}
              role="menu"
              aria-labelledby={triggerId}
              data-part="content"
              data-state={dataState}
              tabIndex={-1}
              onKeyDown={handleContentKeyDown}
            >
              {renderItems(items)}
            </div>
          </div>
        )}
      </div>
    );
  }
);

Menu.displayName = 'Menu';
export default Menu;
