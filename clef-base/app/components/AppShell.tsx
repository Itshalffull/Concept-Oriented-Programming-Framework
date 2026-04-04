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
import { QuickCapture } from './QuickCapture';
import { useClef } from '../../lib/clef-provider';
import { useActiveSpace } from '../../lib/use-active-space';
import { logoutAdminAction } from '../admin/actions';

export const AppShell: React.FC<{ children: React.ReactNode; sessionUser?: string }> = ({
  children,
  sessionUser = '',
}) => {
  const { groupedDestinations, navigator, shell, theme } = useClef();
  const { isInSpace, currentSpace, spaceStack } = useActiveSpace('current-user');

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
      style={{ paddingTop: isInSpace ? 32 : 0 }}
    >
      {isInSpace && currentSpace && (
        <div
          className="space-indicator-bar"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            backgroundColor: 'var(--palette-neutral-100, #f0f0f0)',
            borderBottom: '1px solid var(--palette-neutral-200, #ddd)',
            zIndex: 1000,
            fontSize: 13,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: currentSpace.color ?? 'var(--palette-primary-500, #4f46e5)',
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
            {spaceStack.length > 1 ? (
              <span style={{ color: 'var(--palette-neutral-700, #555)' }}>
                {spaceStack.map((s, i) => (
                  <React.Fragment key={s.id}>
                    {i > 0 && <span style={{ margin: '0 4px', opacity: 0.5 }}>/</span>}
                    <span style={{ fontWeight: i === spaceStack.length - 1 ? 600 : 400 }}>
                      {s.name}
                    </span>
                  </React.Fragment>
                ))}
              </span>
            ) : (
              <span style={{ fontWeight: 600, color: 'var(--palette-neutral-700, #555)' }}>
                {currentSpace.name}
              </span>
            )}
          </div>
          <button
            onClick={() => {
              // Placeholder: would call VersionSpace/leave
            }}
            style={{
              background: 'none',
              border: '1px solid var(--palette-neutral-300, #ccc)',
              borderRadius: 4,
              padding: '2px 10px',
              fontSize: 12,
              cursor: 'pointer',
              color: 'var(--palette-neutral-700, #555)',
            }}
          >
            Leave
          </button>
        </div>
      )}
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
      <QuickCapture />
    </div>
  );
};

export default AppShell;
