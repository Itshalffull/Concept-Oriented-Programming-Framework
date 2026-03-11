'use client';

/**
 * Sidebar — Collapsible navigation panel
 * Implements repertoire/widgets/navigation/sidebar.widget
 */

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { useNavigator } from '../../../lib/clef-provider';

export interface SidebarItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
  badge?: string;
}

export interface SidebarGroup {
  label: string;
  items: SidebarItem[];
}

export interface SidebarProps {
  groups: SidebarGroup[];
  header?: React.ReactNode;
  footer?: React.ReactNode;
  collapsed?: boolean;
  collapsible?: boolean;
  width?: string;
  miniWidth?: string;
  label?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  groups,
  header,
  footer,
  collapsed: controlledCollapsed,
  collapsible = true,
  label = 'Sidebar',
}) => {
  const [internalCollapsed, setCollapsed] = useState(false);
  const collapsed = controlledCollapsed ?? internalCollapsed;
  const { current } = useNavigator();
  const currentHref = current?.href ?? '/';

  const handleToggle = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  return (
    <aside
      role="complementary"
      aria-label={label}
      data-part="sidebar"
      data-state={collapsed ? 'collapsed' : 'expanded'}
      data-collapsible={collapsible ? 'true' : 'false'}
    >
      <div data-part="header" data-state={collapsed ? 'collapsed' : 'expanded'}>
        {collapsed ? (
          <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>C</span>
        ) : (
          header ?? <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>Clef Base</span>
        )}
        {collapsible && (
          <button
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            data-state={collapsed ? 'collapsed' : 'expanded'}
            onClick={handleToggle}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              padding: '4px',
              fontSize: '1rem',
              opacity: 0.6,
            }}
            type="button"
          >
            {collapsed ? '→' : '←'}
          </button>
        )}
      </div>

      <nav role="navigation" aria-label="Sidebar navigation" data-part="content">
        {groups.map((group) => (
          <div key={group.label} role="group" aria-labelledby={`group-${group.label}`}>
            {!collapsed && (
              <div
                data-part="group-label"
                id={`group-${group.label}`}
                aria-hidden={collapsed ? 'true' : 'false'}
              >
                {group.label}
              </div>
            )}
            {group.items.map((item) => {
              const isActive = currentHref === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  role="link"
                  aria-current={isActive ? 'page' : undefined}
                  data-active={isActive ? 'true' : 'false'}
                  data-state={collapsed ? 'collapsed' : 'expanded'}
                  title={collapsed ? item.label : undefined}
                >
                  {item.icon && (
                    <span data-part="item-icon" aria-hidden="true">
                      {item.icon}
                    </span>
                  )}
                  {!collapsed && <span data-part="item-label">{item.label}</span>}
                  {!collapsed && item.badge && (
                    <span data-part="badge" data-variant="secondary" style={{ marginLeft: 'auto' }}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {footer && (
        <div data-part="footer" data-state={collapsed ? 'collapsed' : 'expanded'}>
          {footer}
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
