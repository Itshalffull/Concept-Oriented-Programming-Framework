'use client';

/**
 * AppShell — Root application shell composition
 * Implements clef-base/derived/app-shell.derived
 *
 * Reads Shell zones and Navigator destinations from ClefProvider.
 * Sidebar groups are derived from the destination registry,
 * not hardcoded.
 */

import React from 'react';
import { Sidebar, type SidebarGroup } from './widgets/Sidebar';
import { useClef } from '../../lib/clef-provider';
import { logoutAdminAction } from '../admin/actions';

export const AppShell: React.FC<{ children: React.ReactNode; sessionUser?: string }> = ({
  children,
  sessionUser = '',
}) => {
  const { groupedDestinations, navigator, shell, theme } = useClef();

  // Map grouped destinations → Sidebar groups
  const sidebarGroups: SidebarGroup[] = groupedDestinations.map(g => ({
    label: g.label,
    items: g.items.map(d => ({
      label: d.name.charAt(0).toUpperCase() + d.name.slice(1).replace(/-/g, ' '),
      href: d.href,
      icon: d.icon,
    })),
  }));

  // Derive page title from current destination
  const pageTitle = navigator.current
    ? navigator.current.name.charAt(0).toUpperCase() +
      navigator.current.name.slice(1).replace(/-/g, ' ')
    : 'Clef Base';

  return (
    <div
      className="app-shell"
      data-shell-status={shell.status}
      data-theme-density={theme.density ?? undefined}
      data-theme-motif={theme.motif ?? undefined}
      data-theme-style-profile={theme.styleProfile ?? undefined}
    >
      <Sidebar
        groups={sidebarGroups}
        collapsible={theme.motif !== 'topbar'}
        footer={
          <div className="sidebar-footer-meta">
            <small style={{ opacity: 0.5 }}>v0.1.0</small>
            {sessionUser ? <small>{sessionUser}</small> : null}
          </div>
        }
      />
      <div className="app-shell__main">
        <header className="app-shell__header">
          <h2 style={{
            fontSize: 'var(--typography-heading-sm-size)',
            fontWeight: 'var(--typography-heading-sm-weight)',
          }}>
            {pageTitle}
          </h2>
          <div className="app-shell__session">
            {sessionUser ? <span>{sessionUser}</span> : null}
            <form action={logoutAdminAction}>
              <button type="submit">Log out</button>
            </form>
          </div>
        </header>
        <main className="app-shell__content">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppShell;
