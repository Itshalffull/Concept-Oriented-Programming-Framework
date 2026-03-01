'use client';

import {
  forwardRef,
  useReducer,
  useCallback,
  type ReactNode,
  type HTMLAttributes,
} from 'react';
import { sidebarReducer, type SidebarState } from './Sidebar.reducer.js';

// ---------------------------------------------------------------------------
// Sidebar — Collapsible side navigation panel.
// Supports expanded and collapsed (icon-only) modes with grouped items.
// Derived from sidebar.widget spec.
// ---------------------------------------------------------------------------

export interface SidebarItem {
  label: string;
  icon?: ReactNode;
  badge?: ReactNode;
  href?: string;
  active?: boolean;
  onClick?: () => void;
}

export interface SidebarGroup {
  label?: string;
  items: SidebarItem[];
}

export interface SidebarProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  groups: SidebarGroup[];
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  collapsible?: boolean;
  width?: string;
  miniWidth?: string;
  label?: string;
  header?: ReactNode;
  footer?: ReactNode;
  onCollapsedChange?: (collapsed: boolean) => void;
  onNavigate?: (href: string) => void;
  variant?: string;
  size?: string;
}

export const Sidebar = forwardRef<HTMLElement, SidebarProps>(
  function Sidebar(
    {
      groups,
      collapsed: controlledCollapsed,
      defaultCollapsed = false,
      collapsible = true,
      width = '256px',
      miniWidth = '64px',
      label = 'Sidebar',
      header,
      footer,
      onCollapsedChange,
      onNavigate,
      variant,
      size,
      className,
      ...rest
    },
    ref
  ) {
    const isControlled = controlledCollapsed !== undefined;
    const [internalState, dispatch] = useReducer(
      sidebarReducer,
      defaultCollapsed ? 'collapsed' : 'expanded'
    );

    const currentState: SidebarState = isControlled
      ? (controlledCollapsed ? 'collapsed' : 'expanded')
      : internalState;

    const isExpanded = currentState === 'expanded';
    const dataState = isExpanded ? 'expanded' : 'collapsed';
    const currentWidth = isExpanded ? width : miniWidth;

    const handleToggle = useCallback(() => {
      if (!collapsible) return;
      const newCollapsed = isExpanded;
      if (!isControlled) {
        dispatch({ type: newCollapsed ? 'COLLAPSE' : 'EXPAND' });
      }
      onCollapsedChange?.(newCollapsed);
    }, [collapsible, isExpanded, isControlled, onCollapsedChange]);

    const handleToggleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleToggle();
        }
      },
      [handleToggle]
    );

    const handleItemClick = useCallback(
      (item: SidebarItem) => {
        item.onClick?.();
        if (item.href) onNavigate?.(item.href);
      },
      [onNavigate]
    );

    return (
      <aside
        ref={ref}
        role="complementary"
        aria-label={label}
        className={className}
        data-surface-widget=""
        data-widget-name="sidebar"
        data-part="root"
        data-state={dataState}
        data-collapsible={collapsible ? 'true' : 'false'}
        data-variant={variant}
        data-size={size}
        style={{ width: currentWidth }}
        {...rest}
      >
        {header && (
          <div
            data-part="header"
            data-state={dataState}
          >
            {header}
          </div>
        )}
        <nav
          role="navigation"
          aria-label="Sidebar navigation"
          data-part="content"
        >
          {groups.map((group, gi) => (
            <div
              key={`group-${gi}`}
              role="group"
              aria-labelledby={group.label ? `sidebar-group-${gi}` : undefined}
              data-part="group"
              data-state={dataState}
            >
              {group.label && (
                <span
                  id={`sidebar-group-${gi}`}
                  data-part="group-label"
                  aria-hidden={!isExpanded ? 'true' : 'false'}
                  style={{ display: isExpanded ? undefined : 'none' }}
                >
                  {group.label}
                </span>
              )}
              {group.items.map((item, ii) => (
                <a
                  key={`item-${gi}-${ii}`}
                  href={item.href}
                  role="link"
                  aria-current={item.active ? 'page' : 'false'}
                  data-part="item"
                  data-active={item.active ? 'true' : 'false'}
                  data-state={dataState}
                  tabIndex={0}
                  onClick={(e) => {
                    if (onNavigate && item.href) {
                      e.preventDefault();
                    }
                    handleItemClick(item);
                  }}
                >
                  {item.icon && (
                    <span data-part="item-icon" aria-hidden="true">
                      {item.icon}
                    </span>
                  )}
                  <span
                    data-part="item-label"
                    style={{ display: isExpanded ? undefined : 'none' }}
                  >
                    {item.label}
                  </span>
                  {item.badge && (
                    <span
                      data-part="item-badge"
                      style={{ display: isExpanded ? undefined : 'none' }}
                    >
                      {item.badge}
                    </span>
                  )}
                </a>
              ))}
            </div>
          ))}
        </nav>
        {footer && (
          <div
            data-part="footer"
            data-state={dataState}
          >
            {footer}
          </div>
        )}
        {collapsible && (
          <button
            type="button"
            aria-label={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-expanded={isExpanded}
            data-part="toggle-button"
            data-state={dataState}
            tabIndex={0}
            onClick={handleToggle}
            onKeyDown={handleToggleKeyDown}
          >
            {isExpanded ? 'Collapse' : 'Expand'}
          </button>
        )}
      </aside>
    );
  }
);

Sidebar.displayName = 'Sidebar';
export default Sidebar;
