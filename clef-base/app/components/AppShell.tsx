'use client';

/**
 * AppShell — Root application shell composition
 * Implements clef-base/derived/app-shell.derived
 *
 * Reads Shell zones and Navigator destinations from ClefProvider.
 * Sidebar groups are derived from the destination registry,
 * not hardcoded.
 */

import React, { useState, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar, type SidebarGroup } from './widgets/Sidebar';
import { QuickCapture } from './QuickCapture';
import { useClef, useKernelInvoke } from '../../lib/clef-provider';
import { useActiveSpace } from '../../lib/use-active-space';
import { logoutAdminAction } from '../admin/actions';
import { useKeyBindings } from '../../lib/useKeyBindings';
import { useFirstRunToast } from '../../lib/useFirstRunToast';
import { ModalStackProvider } from './widgets/ModalStackProvider';

export const AppShell: React.FC<{ children: React.ReactNode; sessionUser?: string }> = ({
  children,
  sessionUser = '',
}) => {
  const { groupedDestinations, navigator, shell, theme } = useClef();
  const { isInSpace, currentSpace, spaceStack } = useActiveSpace(sessionUser || 'current-user');
  const invoke = useKernelInvoke();
  const pathname = usePathname();

  // Install the global key-binding dispatcher (KB-16).
  // Listens at document level (capture phase) so all keybinding scopes
  // beneath this root are covered. Must be called once at the app shell.
  useKeyBindings(invoke);

  // First-run keybinding onboarding toast (KB-15).
  // Returns a banner element on first session; null after dismissal.
  const firstRunToast = useFirstRunToast();

  const [leaveConfirming, setLeaveConfirming] = useState(false);
  const [leavePending, setLeavePending] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  const handleLeave = async () => {
    if (!currentSpace) return;
    if (!leaveConfirming) {
      setLeaveConfirming(true);
      return;
    }
    setLeavePending(true);
    setLeaveError(null);
    try {
      const result = await invoke('VersionSpace', 'leave', { space: currentSpace.id });
      if (result && (result as Record<string, unknown>).variant !== 'ok') {
        const msg = (result as Record<string, unknown>).message as string | undefined;
        setLeaveError(msg ?? 'Failed to leave space.');
        setLeaveConfirming(false);
      } else {
        // Navigate to home on success
        window.location.href = '/';
      }
    } catch (err) {
      setLeaveError(err instanceof Error ? err.message : 'Failed to leave space.');
      setLeaveConfirming(false);
    } finally {
      setLeavePending(false);
    }
  };

  // Build a flat href → destination lookup from all groups
  const destinationByHref = useMemo(() => {
    const map = new Map<string, { name: string; href: string }>();
    for (const g of groupedDestinations) {
      for (const d of g.items) {
        map.set(d.href, d);
      }
    }
    return map;
  }, [groupedDestinations]);

  // Derive the active destination from the current pathname (longest-prefix match)
  const currentDestination = useMemo(() => {
    if (destinationByHref.has(pathname)) return destinationByHref.get(pathname)!;
    let best: { name: string; href: string } | undefined;
    for (const [href, dest] of destinationByHref) {
      if (pathname.startsWith(href + '/') || pathname.startsWith(href)) {
        if (!best || href.length > best.href.length) best = dest;
      }
    }
    return best;
  }, [pathname, destinationByHref]);

  // Map grouped destinations → Sidebar groups
  const sidebarGroups: SidebarGroup[] = groupedDestinations.map(g => ({
    label: g.label,
    items: g.items.map(d => ({
      label: d.name.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      href: d.href,
      icon: d.icon,
    })),
  }));

  // Derive page title — prefer pathname-matched destination over navigator.current
  const activeDestName = currentDestination?.name ?? navigator.current?.name;
  const pageTitle = activeDestName
    ? activeDestName.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    : 'Clef Base';

  return (
    <ModalStackProvider>
    <div
      className="app-shell"
      data-shell-status={shell.status}
      data-theme-density={theme.density ?? undefined}
      data-theme-motif={theme.motif ?? undefined}
      data-theme-style-profile={theme.styleProfile ?? undefined}
      data-keybinding-scope="app"
      style={{ paddingTop: isInSpace ? 32 : 0 }}
    >
      {/* First-run keybinding onboarding toast — mounts once, dismissed persistently (KB-15) */}
      {firstRunToast}
      {isInSpace && currentSpace && (
        <div className="space-indicator-bar">
          <div className="space-indicator-bar__context">
            <span
              className="space-indicator-bar__dot"
              style={{ backgroundColor: currentSpace.color ?? 'var(--palette-primary)' }}
            />
            {spaceStack.length > 1 ? (
              <span className="space-indicator-bar__crumbs">
                {spaceStack.map((s, i) => (
                  <React.Fragment key={s.id}>
                    {i > 0 && <span className="space-indicator-bar__separator">/</span>}
                    <span
                      className="space-indicator-bar__crumb"
                      data-current={i === spaceStack.length - 1 ? 'true' : 'false'}
                    >
                      {s.name}
                    </span>
                  </React.Fragment>
                ))}
              </span>
            ) : (
              <span className="space-indicator-bar__crumb" data-current="true">{currentSpace.name}</span>
            )}
          </div>
          <div className="space-indicator-bar__actions">
            {leaveError && (
              <span className="space-indicator-bar__error">{leaveError}</span>
            )}
            {leaveConfirming && !leavePending && (
              <button
                onClick={() => setLeaveConfirming(false)}
                className="space-indicator-bar__button"
                data-variant="quiet"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleLeave}
              disabled={leavePending}
              className="space-indicator-bar__button"
              data-variant={leaveConfirming ? 'destructive' : 'quiet'}
            >
              {leavePending ? '…' : leaveConfirming ? 'Confirm leave' : 'Leave'}
            </button>
          </div>
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
    </ModalStackProvider>
  );
};

export default AppShell;
