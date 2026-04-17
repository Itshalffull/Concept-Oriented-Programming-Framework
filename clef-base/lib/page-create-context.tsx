'use client';

/**
 * PageCreateContext — signals whether the current page already provides
 * its own "Create X" affordance so the global FAB can suppress itself.
 *
 * Implementation uses a tiny global external store instead of React context
 * because the FAB is rendered in the outer AppShell layout (parent), while
 * the signal is emitted by page content (child). React context only flows
 * downward, so a Provider inside the page tree cannot be read by a consumer
 * in the parent layout. A global store solves this by letting any component
 * at any depth push a value that any other component can subscribe to.
 *
 * Usage:
 *   - Writer: call usePageHasCreateSignal(true) inside the page component.
 *     The hook mounts an effect that sets the global flag and resets it to
 *     false on unmount, so the FAB reappears when the page unmounts.
 *   - Reader: call usePageHasCreate() anywhere in the tree.
 *
 * ViewRenderer calls usePageHasCreateSignal(!!controls.create).
 * SchemaFieldsEditor calls usePageHasCreateSignal(!isCreate).
 * QuickCapture calls usePageHasCreate() to decide whether to show the FAB.
 */

import { useEffect, useSyncExternalStore } from 'react';

// ── Global store (module-level singleton) ──────────────────────────────────────

let _hasCreate = false;
const _listeners = new Set<() => void>();

function _notify() {
  for (const listener of _listeners) listener();
}

function _subscribe(listener: () => void) {
  _listeners.add(listener);
  return () => { _listeners.delete(listener); };
}

function _getSnapshot() {
  return _hasCreate;
}

// Server snapshot — always false (FAB visible) during SSR.
function _getServerSnapshot() {
  return false;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Read-side hook: returns true when the current page declares its own create button.
 * Re-renders automatically when the value changes.
 */
export function usePageHasCreate(): boolean {
  return useSyncExternalStore(_subscribe, _getSnapshot, _getServerSnapshot);
}

/**
 * Write-side hook: push `hasCreate` into the global store on mount and reset
 * to false on unmount. Components call this at the top of their render body
 * (the effect runs after paint and cleans up when the component leaves the tree).
 *
 * @param hasCreate - true when this page already provides its own create affordance.
 */
export function usePageHasCreateSignal(hasCreate: boolean): void {
  useEffect(() => {
    if (hasCreate) {
      _hasCreate = true;
      _notify();
      return () => {
        _hasCreate = false;
        _notify();
      };
    }
    // When hasCreate is false there is nothing to set (default is already false).
    return undefined;
  }, [hasCreate]);
}
