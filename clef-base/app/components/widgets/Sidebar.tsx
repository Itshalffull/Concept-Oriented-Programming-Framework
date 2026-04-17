'use client';

/**
 * Sidebar — Collapsible navigation panel
 * Implements repertoire/widgets/navigation/sidebar.widget
 *
 * Active-link invariant: exactly one nav link carries data-active="true" at a
 * time, and it is the destination whose href is the longest prefix of the
 * current pathname (or an exact match). The root destination (/admin) is
 * treated as a non-prefix: it is active only when the pathname IS /admin or
 * /admin/ — never just because every /admin/* path starts with it.
 */

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

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

/**
 * Determine whether a sidebar item href is active for the given pathname.
 *
 * Rules (Section 16.12 — active-link semantics):
 *   1. Exact match: pathname === href  →  active
 *   2. Prefix match: pathname starts with href + '/'  →  active
 *      Exception: if the item href is '/' or equals a bare root path that is a
 *      true prefix of every other route (e.g. '/admin'), we only allow exact
 *      match so that the root destination does not shadow all child destinations.
 *
 * "Bare root path" is defined as: any registered href for which there exists
 * another registered href that starts with it. We detect this at call-site by
 * checking whether any sibling href is a strict prefix extension of this href.
 */
function isItemActive(itemHref: string, pathname: string, allHrefs: string[]): boolean {
  if (pathname === itemHref) return true;
  // Prefix match — but only if no other registered destination is a strict
  // prefix-extension of this href (i.e. this href is not itself a landing
  // redirect whose children are their own destinations).
  const hasMoreSpecificSibling = allHrefs.some(
    (other) => other !== itemHref && other.startsWith(itemHref + '/'),
  );
  if (hasMoreSpecificSibling) {
    // This href is a root/parent of other registered destinations.
    // Only consider it active on an exact pathname match (already handled above).
    return false;
  }
  return pathname.startsWith(itemHref + '/');
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
  const pathname = usePathname();

  // Collect all registered hrefs so isItemActive can detect parent destinations.
  const allHrefs = groups.flatMap((g) => g.items.map((item) => item.href));

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
          <span data-part="brand-mark">C</span>
        ) : (
          header ?? <span data-part="brand-name">Clef Base</span>
        )}
        {collapsible && (
          <button
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            data-part="toggle"
            data-state={collapsed ? 'collapsed' : 'expanded'}
            onClick={handleToggle}
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
              const isActive = isItemActive(item.href, pathname, allHrefs);
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
                    <span data-part="badge" data-variant="secondary">
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
