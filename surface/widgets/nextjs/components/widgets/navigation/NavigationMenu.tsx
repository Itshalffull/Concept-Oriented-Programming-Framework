'use client';

import {
  forwardRef,
  useReducer,
  useCallback,
  useRef,
  useId,
  type ReactNode,
  type HTMLAttributes,
} from 'react';
import { navMenuReducer } from './NavigationMenu.reducer.js';

// ---------------------------------------------------------------------------
// NavigationMenu — Horizontal nav with dropdown content panels.
// Supports hover-triggered flyout content, mobile hamburger toggle.
// Derived from navigation-menu.widget spec.
// ---------------------------------------------------------------------------

export interface NavigationMenuItem {
  type: 'trigger' | 'link';
  label: string;
  href?: string;
  active?: boolean;
  content?: ReactNode;
}

export interface NavigationMenuProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  items: NavigationMenuItem[];
  orientation?: 'horizontal' | 'vertical';
  delayDuration?: number;
  skipDelayDuration?: number;
  onNavigate?: (href: string) => void;
  variant?: string;
  size?: string;
}

export const NavigationMenu = forwardRef<HTMLElement, NavigationMenuProps>(
  function NavigationMenu(
    {
      items,
      orientation = 'horizontal',
      delayDuration = 200,
      skipDelayDuration = 300,
      onNavigate,
      variant,
      size,
      className,
      ...rest
    },
    ref
  ) {
    const id = useId();
    const [state, dispatch] = useReducer(navMenuReducer, {
      openItem: null,
      mobileExpanded: false,
    });

    const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const unhoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleOpen = useCallback(
      (index: number) => {
        if (unhoverTimerRef.current) {
          clearTimeout(unhoverTimerRef.current);
          unhoverTimerRef.current = null;
        }
        hoverTimerRef.current = setTimeout(() => {
          dispatch({ type: 'OPEN', index });
        }, state.openItem !== null ? 0 : delayDuration);
      },
      [delayDuration, state.openItem]
    );

    const handleClose = useCallback(() => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
      unhoverTimerRef.current = setTimeout(() => {
        dispatch({ type: 'CLOSE' });
      }, skipDelayDuration);
    }, [skipDelayDuration]);

    const handleItemClick = useCallback(
      (index: number) => {
        if (state.openItem === index) {
          dispatch({ type: 'CLOSE' });
        } else {
          dispatch({ type: 'OPEN', index });
        }
      },
      [state.openItem]
    );

    const handleLinkClick = useCallback(
      (href?: string) => {
        dispatch({ type: 'NAVIGATE' });
        if (href) onNavigate?.(href);
      },
      [onNavigate]
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent, index: number, item: NavigationMenuItem) => {
        switch (e.key) {
          case 'ArrowDown':
            if (item.type === 'trigger') {
              e.preventDefault();
              dispatch({ type: 'OPEN', index });
            }
            break;
          case 'Escape':
            e.preventDefault();
            dispatch({ type: 'CLOSE' });
            break;
          case 'Enter':
          case ' ':
            if (item.type === 'trigger') {
              e.preventDefault();
              handleItemClick(index);
            }
            break;
          default:
            break;
        }
      },
      [handleItemClick]
    );

    return (
      <nav
        ref={ref}
        role="navigation"
        aria-label="Main navigation"
        className={className}
        data-surface-widget=""
        data-widget-name="navigation-menu"
        data-part="root"
        data-orientation={orientation}
        data-variant={variant}
        data-size={size}
        {...rest}
      >
        <div
          role="menubar"
          aria-orientation={orientation}
          data-part="list"
          data-orientation={orientation}
        >
          {items.map((item, index) => {
            const isOpen = state.openItem === index;
            const itemState = isOpen ? 'open' : 'closed';
            const triggerId = `navmenu-trigger-${id}-${index}`;
            const contentId = `navmenu-content-${id}-${index}`;

            return (
              <div
                key={`${item.label}-${index}`}
                data-part="item"
                data-state={itemState}
                onPointerEnter={() => {
                  if (item.type === 'trigger') handleOpen(index);
                }}
                onPointerLeave={() => {
                  if (item.type === 'trigger') handleClose();
                }}
              >
                {item.type === 'trigger' ? (
                  <>
                    <button
                      id={triggerId}
                      type="button"
                      role="menuitem"
                      aria-haspopup="true"
                      aria-expanded={isOpen}
                      aria-controls={contentId}
                      data-part="trigger"
                      data-state={itemState}
                      tabIndex={0}
                      onClick={() => handleItemClick(index)}
                      onKeyDown={(e) => handleKeyDown(e, index, item)}
                    >
                      {item.label}
                    </button>
                    {isOpen && item.content && (
                      <div
                        id={contentId}
                        role="menu"
                        aria-labelledby={triggerId}
                        data-part="content"
                        data-state={itemState}
                        data-orientation={orientation}
                      >
                        {item.content}
                      </div>
                    )}
                  </>
                ) : (
                  <a
                    href={item.href}
                    role="menuitem"
                    aria-current={item.active ? 'page' : 'false'}
                    data-part="link"
                    data-active={item.active ? 'true' : 'false'}
                    tabIndex={0}
                    onClick={(e) => {
                      if (onNavigate && item.href) {
                        e.preventDefault();
                        handleLinkClick(item.href);
                      }
                    }}
                  >
                    {item.label}
                  </a>
                )}
              </div>
            );
          })}
        </div>
        <span
          data-part="indicator"
          data-state={state.openItem !== null ? 'open' : 'closed'}
          data-orientation={orientation}
          aria-hidden="true"
        />
        <div
          data-part="viewport"
          data-state={state.openItem !== null ? 'open' : 'closed'}
          data-orientation={orientation}
          aria-hidden="true"
        />
      </nav>
    );
  }
);

NavigationMenu.displayName = 'NavigationMenu';
export default NavigationMenu;
