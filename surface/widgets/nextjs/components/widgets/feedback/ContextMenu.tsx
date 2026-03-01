'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  type HTMLAttributes,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import { useFloatingPosition, type Placement } from '../shared/useFloatingPosition.js';
import { useOutsideClick } from '../shared/useOutsideClick.js';
import { contextMenuReducer } from './ContextMenu.reducer.js';

/* ---------------------------------------------------------------------------
 * Item type
 * ------------------------------------------------------------------------- */

export interface ContextMenuItem {
  /** Display label for the menu item. */
  label: string;
  /** Action identifier emitted on selection. */
  action: string;
  /** Optional icon name. */
  icon?: string;
  /** Whether the item is disabled. */
  disabled?: boolean;
  /** Whether the item represents a destructive action. */
  destructive?: boolean;
  /** Set to 'separator' to render a visual divider. */
  type?: 'item' | 'separator' | 'label';
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface ContextMenuProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  /** Menu items to render. */
  items?: ContextMenuItem[];
  /** Callback invoked when a menu item is selected. */
  onSelect?: (action: string) => void;
  /** The trigger region (children receive the right-click handler). */
  children: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const ContextMenu = forwardRef<HTMLDivElement, ContextMenuProps>(function ContextMenu(
  { items = [], onSelect, children, ...rest },
  ref,
) {
  const [state, send] = useReducer(contextMenuReducer, 'closed');
  const isOpen = state === 'open';

  const triggerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const positionerRef = useRef<HTMLDivElement>(null);
  const pointerPosition = useRef({ x: 0, y: 0 });
  const [highlightedIndex, setHighlightedIndex] = useReducer(
    (_: number, next: number) => next,
    -1,
  );

  // Virtual anchor for positioning at pointer coordinates
  const anchorRef = useRef<HTMLDivElement>(null);

  const position = useFloatingPosition(anchorRef, positionerRef, {
    placement: 'bottom-start' as Placement,
    offset: 0,
    enabled: isOpen,
  });

  const handleContextMenu = useCallback((e: ReactMouseEvent) => {
    e.preventDefault();
    pointerPosition.current = { x: e.clientX, y: e.clientY };
    // Move anchor to pointer coordinates
    if (anchorRef.current) {
      anchorRef.current.style.position = 'fixed';
      anchorRef.current.style.left = `${e.clientX}px`;
      anchorRef.current.style.top = `${e.clientY}px`;
      anchorRef.current.style.width = '0px';
      anchorRef.current.style.height = '0px';
      anchorRef.current.style.pointerEvents = 'none';
    }
    send({ type: 'CONTEXT_MENU' });
  }, []);

  const handleSelect = useCallback(
    (action: string) => {
      send({ type: 'SELECT' });
      onSelect?.(action);
    },
    [onSelect],
  );

  // Outside click
  useOutsideClick(contentRef, () => {
    send({ type: 'OUTSIDE_CLICK' });
  }, isOpen);

  // Escape key and keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const actionItems = items.filter(
      (item) => item.type !== 'separator' && item.type !== 'label',
    );

    const onKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          send({ type: 'ESCAPE' });
          break;
        case 'ArrowDown': {
          e.preventDefault();
          setHighlightedIndex(
            highlightedIndex < actionItems.length - 1 ? highlightedIndex + 1 : 0,
          );
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          setHighlightedIndex(
            highlightedIndex > 0 ? highlightedIndex - 1 : actionItems.length - 1,
          );
          break;
        }
        case 'Home':
          e.preventDefault();
          setHighlightedIndex(0);
          break;
        case 'End':
          e.preventDefault();
          setHighlightedIndex(actionItems.length - 1);
          break;
        case 'Enter':
        case ' ': {
          e.preventDefault();
          const item = actionItems[highlightedIndex];
          if (item && !item.disabled) {
            handleSelect(item.action);
          }
          break;
        }
        default:
          break;
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, highlightedIndex, items, handleSelect]);

  // Focus the menu content when opened
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => contentRef.current?.focus());
    }
  }, [isOpen]);

  return (
    <div
      ref={ref}
      data-part="root"
      data-state={isOpen ? 'open' : 'closed'}
      data-surface-widget=""
      data-widget-name="context-menu"
      {...rest}
    >
      {/* Virtual anchor for pointer-based positioning */}
      <div ref={anchorRef} aria-hidden style={{ position: 'fixed', width: 0, height: 0, pointerEvents: 'none' }} />

      <div
        ref={triggerRef}
        data-part="trigger"
        onContextMenu={handleContextMenu}
      >
        {children}
      </div>

      {isOpen && (
        <div
          ref={positionerRef}
          data-part="positioner"
          data-state="open"
          style={{
            position: 'fixed',
            left: pointerPosition.current.x,
            top: pointerPosition.current.y,
          }}
        >
          <div
            ref={contentRef}
            data-part="content"
            role="menu"
            aria-label="Context menu"
            data-state="open"
            tabIndex={-1}
          >
            {items.map((item, index) => {
              if (item.type === 'separator') {
                return (
                  <div
                    key={`sep-${index}`}
                    data-part="separator"
                    role="separator"
                    aria-orientation="horizontal"
                  />
                );
              }
              if (item.type === 'label') {
                return (
                  <div
                    key={`label-${index}`}
                    data-part="label"
                    role="presentation"
                  >
                    {item.label}
                  </div>
                );
              }

              const actionIndex = items
                .filter((i) => i.type !== 'separator' && i.type !== 'label')
                .indexOf(item);

              return (
                <div
                  key={item.action}
                  data-part="item"
                  role="menuitem"
                  tabIndex={-1}
                  aria-disabled={item.disabled || undefined}
                  data-destructive={item.destructive || undefined}
                  data-highlighted={actionIndex === highlightedIndex || undefined}
                  onClick={() => {
                    if (!item.disabled) handleSelect(item.action);
                  }}
                  onPointerEnter={() => setHighlightedIndex(actionIndex)}
                >
                  {item.label}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

ContextMenu.displayName = 'ContextMenu';
export { ContextMenu };
export default ContextMenu;
