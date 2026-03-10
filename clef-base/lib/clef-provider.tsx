'use client';

/**
 * ClefProvider — React context provider bridging the Clef kernel
 * (Navigator, Host, Shell) to Next.js App Router.
 *
 * Implements the AppShell derived concept's runtime:
 * - Initializes Shell with zones on mount
 * - Registers all destinations with Navigator
 * - Syncs Next.js pathname ↔ Navigator state bidirectionally
 * - Exposes useClef(), useNavigator(), useShell(), useHost() hooks
 */

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { destinations, destinationByHref, destinationByName, groupedDestinations, type Destination } from './destinations';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NavigatorState {
  current: Destination | null;
  history: Destination[];
  canGoBack: boolean;
  canGoForward: boolean;
}

interface ShellState {
  zones: Record<string, string>; // zone name → host ref
  status: 'initializing' | 'ready' | 'error';
  overlays: string[];
}

interface HostState {
  id: string;
  concept: string;
  view: string;
  zone: string;
  status: 'mounting' | 'mounted' | 'ready' | 'error' | 'unmounted';
}

interface ClefContextValue {
  // Navigator
  navigator: NavigatorState;
  navigate: (name: string) => void;
  navigateToHref: (href: string) => void;
  goBack: () => void;
  goForward: () => void;

  // Shell
  shell: ShellState;

  // Host
  currentHost: HostState | null;
  mountHost: (concept: string, view: string, zone?: string) => string;
  unmountHost: (hostId: string) => void;
  setHostReady: (hostId: string) => void;

  // Destinations
  destinations: Destination[];
  groupedDestinations: { label: string; items: Destination[] }[];

  // Kernel invoke
  invoke: (concept: string, action: string, input: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

const ClefContext = createContext<ClefContextValue | null>(null);

// ---------------------------------------------------------------------------
// Shell zone definitions
// ---------------------------------------------------------------------------

const SHELL_ZONES = ['sidebar', 'primary', 'overlay'] as const;
type ZoneName = typeof SHELL_ZONES[number];

const ZONE_ROLES: Record<ZoneName, string> = {
  sidebar: 'persistent',
  primary: 'navigated',
  overlay: 'transient',
};

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

let hostCounter = 0;

export const ClefProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const router = useRouter();
  const initialized = useRef(false);

  // Navigator state
  const [navState, setNavState] = useState<NavigatorState>({
    current: null,
    history: [],
    canGoBack: false,
    canGoForward: false,
  });
  const forwardStack = useRef<Destination[]>([]);

  // Shell state
  const [shellState, setShellState] = useState<ShellState>({
    zones: Object.fromEntries(SHELL_ZONES.map(z => [z, ''])),
    status: 'initializing',
  overlays: [],
  });

  // Host state
  const [hosts, setHosts] = useState<Map<string, HostState>>(new Map());
  const [currentHostId, setCurrentHostId] = useState<string | null>(null);

  // ------------------------------------------------------------------
  // Initialize Shell (runs once on mount)
  // ------------------------------------------------------------------
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Shell/initialize — set up zones
    setShellState(prev => ({
      ...prev,
      status: 'ready',
    }));
  }, []);

  // ------------------------------------------------------------------
  // Sync pathname → Navigator (Next.js is source of truth for URL)
  // ------------------------------------------------------------------
  useEffect(() => {
    const dest = destinationByHref(pathname);
    if (!dest) return;

    // Only update if actually changed
    if (navState.current?.name === dest.name) return;

    setNavState(prev => {
      const history = prev.current
        ? [...prev.history, prev.current]
        : prev.history;

      return {
        current: dest,
        history,
        canGoBack: history.length > 0,
        canGoForward: false,
      };
    });
    forwardStack.current = [];

    // Mount host for this destination
    const hostId = `host-${++hostCounter}`;
    const newHost: HostState = {
      id: hostId,
      concept: dest.targetConcept,
      view: dest.targetView,
      zone: 'primary',
      status: 'mounted',
    };

    setHosts(prev => {
      const next = new Map(prev);
      // Unmount previous primary host
      for (const [id, host] of next) {
        if (host.zone === 'primary' && host.status !== 'unmounted') {
          next.set(id, { ...host, status: 'unmounted' });
        }
      }
      next.set(hostId, newHost);
      return next;
    });
    setCurrentHostId(hostId);

    // Shell/assignToZone
    setShellState(prev => ({
      ...prev,
      zones: { ...prev.zones, primary: hostId },
    }));
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------------------------
  // Navigation actions
  // ------------------------------------------------------------------
  const navigate = useCallback((name: string) => {
    const dest = destinationByName(name);
    if (!dest) {
      console.warn(`[ClefProvider] Destination "${name}" not found`);
      return;
    }
    router.push(dest.href);
  }, [router]);

  const navigateToHref = useCallback((href: string) => {
    router.push(href);
  }, [router]);

  const goBack = useCallback(() => {
    if (navState.history.length === 0) return;
    const prev = navState.history[navState.history.length - 1];
    if (navState.current) {
      forwardStack.current = [...forwardStack.current, navState.current];
    }
    setNavState(s => ({
      current: prev,
      history: s.history.slice(0, -1),
      canGoBack: s.history.length > 1,
      canGoForward: true,
    }));
    router.push(prev.href);
  }, [navState, router]);

  const goForward = useCallback(() => {
    if (forwardStack.current.length === 0) return;
    const next = forwardStack.current[forwardStack.current.length - 1];
    forwardStack.current = forwardStack.current.slice(0, -1);
    router.push(next.href);
  }, [router]);

  // ------------------------------------------------------------------
  // Host actions
  // ------------------------------------------------------------------
  const mountHost = useCallback((concept: string, view: string, zone = 'primary') => {
    const hostId = `host-${++hostCounter}`;
    const host: HostState = { id: hostId, concept, view, zone, status: 'mounted' };
    setHosts(prev => new Map(prev).set(hostId, host));
    setShellState(prev => ({
      ...prev,
      zones: { ...prev.zones, [zone]: hostId },
    }));
    return hostId;
  }, []);

  const unmountHost = useCallback((hostId: string) => {
    setHosts(prev => {
      const next = new Map(prev);
      const host = next.get(hostId);
      if (host) next.set(hostId, { ...host, status: 'unmounted' });
      return next;
    });
  }, []);

  const setHostReady = useCallback((hostId: string) => {
    setHosts(prev => {
      const next = new Map(prev);
      const host = next.get(hostId);
      if (host && host.status === 'mounted') {
        next.set(hostId, { ...host, status: 'ready' });
      }
      return next;
    });
  }, []);

  // ------------------------------------------------------------------
  // Kernel invoke (server-side via API route)
  // ------------------------------------------------------------------
  const invoke = useCallback(async (concept: string, action: string, input: Record<string, unknown>) => {
    const res = await fetch(`/api/invoke/${concept}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return res.json();
  }, []);

  // ------------------------------------------------------------------
  // Context value
  // ------------------------------------------------------------------
  const currentHost = currentHostId ? hosts.get(currentHostId) ?? null : null;

  const value: ClefContextValue = {
    navigator: navState,
    navigate,
    navigateToHref,
    goBack,
    goForward,
    shell: shellState,
    currentHost,
    mountHost,
    unmountHost,
    setHostReady,
    destinations,
    groupedDestinations: groupedDestinations(),
    invoke,
  };

  return (
    <ClefContext.Provider value={value}>
      {children}
    </ClefContext.Provider>
  );
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useClef(): ClefContextValue {
  const ctx = useContext(ClefContext);
  if (!ctx) throw new Error('useClef must be used within <ClefProvider>');
  return ctx;
}

export function useNavigator() {
  const { navigator, navigate, navigateToHref, goBack, goForward } = useClef();
  return { ...navigator, navigate, navigateToHref, goBack, goForward };
}

export function useShell() {
  const { shell } = useClef();
  return shell;
}

export function useHost() {
  const { currentHost, mountHost, unmountHost, setHostReady } = useClef();
  return { host: currentHost, mountHost, unmountHost, setHostReady };
}

export function useDestinations() {
  const { destinations: dests, groupedDestinations: grouped } = useClef();
  return { destinations: dests, grouped };
}

export function useKernelInvoke() {
  const { invoke } = useClef();
  return invoke;
}
