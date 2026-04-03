'use client';

/**
 * ClefProvider — React context provider bridging the Clef kernel
 * (Navigator, Host, Shell) to Next.js App Router.
 *
 * Implements the AppShell derived concept's runtime:
 * - Initializes Shell with zones on mount
 * - Loads destinations from DestinationCatalog
 * - Syncs Next.js pathname ↔ Navigator state bidirectionally
 * - Exposes useClef(), useNavigator(), useShell(), useHost() hooks
 */

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  destinationByHref,
  destinationByName,
  groupDestinations,
  type Destination,
} from './destinations';
import {
  bootstrapUiApp,
  createInitialUiAppSnapshot,
  markHostReady as markHostReadyInRuntime,
  syncPathToUiApp,
  UI_APP_IDS,
  unmountHost as unmountHostInRuntime,
} from './ui-app-runtime';
import {
  applyDocumentTheme,
  pickActiveTheme,
  resolveThemeDocumentState,
  type ThemeDocumentState,
  type ThemeRecord,
} from './theme-selection';

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
  zones: Record<string, string>;
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

interface ActiveThemeState {
  id: string;
  mode: string | null;
  density: string | null;
  motif: string | null;
  styleProfile: string | null;
  sourceType: string | null;
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
  theme: ActiveThemeState;

  // Windowing
  activeWorkspaceId: string | null;
  activeSplitLayoutId: string | null;
  switchWorkspace: (workspaceId: string) => void;
  saveWorkspace: () => void;

  // Kernel invoke
  invoke: (concept: string, action: string, input: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

const ClefContext = createContext<ClefContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export const ClefProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const router = useRouter();
  const initialized = useRef(false);
  const bootstrapping = useRef<Promise<void> | null>(null);
  const snapshotRef = useRef(createInitialUiAppSnapshot());

  // Navigator state
  const [navState, setNavState] = useState<NavigatorState>(snapshotRef.current.navigator);
  const forwardStack = useRef<Destination[]>([]);

  // Shell state
  const [shellState, setShellState] = useState<ShellState>(snapshotRef.current.shell);

  // Host state
  const [hosts, setHosts] = useState<Map<string, HostState>>(new Map());
  const [currentHostId, setCurrentHostId] = useState<string | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [activeSplitLayoutId, setActiveSplitLayoutId] = useState<string | null>(null);
  const [theme, setTheme] = useState<ActiveThemeState>({
    id: 'light',
    mode: null,
    density: null,
    motif: null,
    styleProfile: null,
    sourceType: null,
  });

  // ------------------------------------------------------------------
  const rawInvoke = useCallback(async (concept: string, action: string, input: Record<string, unknown>) => {
    const res = await fetch(`/api/invoke/${concept}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return res.json();
  }, []);

  const syncActiveTheme = useCallback(async () => {
    try {
      const result = await rawInvoke('Theme', 'list', {});
      const items = typeof result.items === 'string'
        ? JSON.parse(result.items) as ThemeRecord[]
        : [];
      const themeId = pickActiveTheme(items);
      const resolved = await rawInvoke('Theme', 'resolve', { theme: themeId });
      const resolvedTokens = resolved.variant === 'ok' && typeof resolved.tokens === 'string'
        ? JSON.parse(resolved.tokens) as Record<string, unknown>
        : {};
      const selection = resolveThemeDocumentState(items, resolvedTokens);
      applyDocumentTheme(selection);
      setTheme({
        id: selection.id,
        mode: selection.mode,
        density: selection.density,
        motif: selection.motif,
        styleProfile: selection.styleProfile,
        sourceType: selection.sourceType,
      });
    } catch {
      // fall through
    }
  }, [rawInvoke]);

  const invoke = useCallback(async (concept: string, action: string, input: Record<string, unknown>) => {
    const result = await rawInvoke(concept, action, input);
    if (
      concept === 'Theme'
      && result.variant === 'ok'
      && ['create', 'extend', 'activate', 'deactivate'].includes(action)
    ) {
      void syncActiveTheme();
    }
    return result;
  }, [rawInvoke, syncActiveTheme]);

  const applySnapshot = useCallback((nextSnapshot: ReturnType<typeof createInitialUiAppSnapshot>) => {
    snapshotRef.current = nextSnapshot;
    setNavState(nextSnapshot.navigator);
    setShellState(nextSnapshot.shell);
    setCurrentHostId(nextSnapshot.currentHost?.id ?? null);
    setHosts((prev) => {
      const next = new Map(prev);
      if (nextSnapshot.currentHost) {
        next.set(nextSnapshot.currentHost.id, nextSnapshot.currentHost);
      }
      return next;
    });
  }, []);

  const loadDestinations = useCallback(async () => {
    const response = await invoke('DestinationCatalog', 'list', {});
    const records = Array.isArray(response.destinations)
      ? response.destinations as Destination[]
      : [];
    setDestinations(records);
    return records;
  }, [invoke]);

  // Initialize Shell (runs once on mount)
  // ------------------------------------------------------------------
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    bootstrapping.current = Promise.all([
      bootstrapUiApp(invoke),
      loadDestinations(),
    ])
      .then(([nextSnapshot]) => applySnapshot(nextSnapshot))
      .catch(() => {
        setShellState((prev) => ({ ...prev, status: 'error' }));
      });
  }, [applySnapshot, invoke, loadDestinations]);

  useEffect(() => {
    void syncActiveTheme();
  }, [syncActiveTheme]);

  // ------------------------------------------------------------------
  // Sync pathname → Navigator (Next.js is source of truth for URL)
  // ------------------------------------------------------------------
  useEffect(() => {
    const dest = destinationByHref(destinations, pathname);
    if (!dest) return;

    // Only update if actually changed
    if (navState.current?.name === dest.name) return;

    const sync = async () => {
      if (bootstrapping.current) {
        await bootstrapping.current;
      }

      const nextSnapshot = await syncPathToUiApp(invoke, snapshotRef.current, dest);
      forwardStack.current = [];
      applySnapshot(nextSnapshot);
    };

    sync().catch(() => {
      setShellState((prev) => ({ ...prev, status: 'error' }));
    });
  }, [applySnapshot, destinations, invoke, navState.current?.name, pathname]);

  // ------------------------------------------------------------------
  // Navigation actions
  // ------------------------------------------------------------------
  const navigate = useCallback((name: string) => {
    const dest = destinationByName(destinations, name);
    if (!dest) {
      console.warn(`[ClefProvider] Destination "${name}" not found`);
      return;
    }
    router.push(dest.href);
  }, [destinations, router]);

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
    const hostId = `${UI_APP_IDS.shell}:${zone}:${concept}:${view}`;
    const host: HostState = { id: hostId, concept, view, zone, status: 'mounted' };
    setHosts(prev => new Map(prev).set(hostId, host));
    setShellState(prev => ({
      ...prev,
      zones: { ...prev.zones, [zone]: hostId },
    }));
    return hostId;
  }, []);

  const unmountHost = useCallback((hostId: string) => {
    unmountHostInRuntime(invoke, snapshotRef.current, hostId)
      .then((nextSnapshot) => applySnapshot(nextSnapshot))
      .catch(() => {
        setHosts((prev) => {
          const next = new Map(prev);
          const host = next.get(hostId);
          if (host) next.set(hostId, { ...host, status: 'unmounted' });
          return next;
        });
      });
  }, [applySnapshot, invoke]);

  const setHostReady = useCallback((hostId: string) => {
    markHostReadyInRuntime(invoke, snapshotRef.current, hostId)
      .then((nextSnapshot) => applySnapshot(nextSnapshot))
      .catch(() => {
        setHosts((prev) => {
          const next = new Map(prev);
          const host = next.get(hostId);
          if (host && host.status === 'mounted') {
            next.set(hostId, { ...host, status: 'ready' });
          }
          return next;
        });
      });
  }, [applySnapshot, invoke]);

  // ------------------------------------------------------------------
  // Workspace actions
  // ------------------------------------------------------------------
  const switchWorkspace = useCallback((workspaceId: string) => {
    invoke('Workspace', 'restore', { workspace: workspaceId })
      .then((result) => {
        if (result.variant === 'ok' && typeof result.snapshot === 'string') {
          setActiveWorkspaceId(workspaceId);
          // Parse snapshot to extract the split layout ID
          try {
            const snapshot = JSON.parse(result.snapshot);
            if (snapshot.splitLayoutId) {
              setActiveSplitLayoutId(snapshot.splitLayoutId);
            }
          } catch { /* snapshot parse failure — layout stays as-is */ }
        }
      })
      .catch(() => {});
  }, [invoke]);

  const saveWorkspace = useCallback(() => {
    if (!activeWorkspaceId) return;
    // Capture current state as workspace snapshot
    const snapshot = JSON.stringify({
      splitLayoutId: activeSplitLayoutId,
      timestamp: new Date().toISOString(),
    });
    invoke('Workspace', 'save', { workspace: activeWorkspaceId, snapshot })
      .catch(() => {});
  }, [invoke, activeWorkspaceId, activeSplitLayoutId]);

  // Load default workspace on first mount
  useEffect(() => {
    if (activeWorkspaceId) return; // Already loaded
    invoke('Workspace', 'list', { owner: 'system' })
      .then((result) => {
        if (result.variant !== 'ok') return;
        const workspaces: Array<Record<string, unknown>> = (() => {
          if (typeof result.workspaces === 'string') {
            try { return JSON.parse(result.workspaces); } catch { return []; }
          }
          return Array.isArray(result.workspaces) ? result.workspaces : [];
        })();
        const defaultWs = workspaces.find(w => w.isDefault === true) ?? workspaces[0];
        if (defaultWs) {
          switchWorkspace(defaultWs.workspace as string);
        }
      })
      .catch(() => {});
  }, [activeWorkspaceId, invoke, switchWorkspace]);

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
    groupedDestinations: groupDestinations(destinations),
    activeWorkspaceId,
    activeSplitLayoutId,
    switchWorkspace,
    saveWorkspace,
    theme,
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

export function useActiveTheme() {
  const { theme } = useClef();
  return theme;
}

export function useWorkspace() {
  const { activeWorkspaceId, activeSplitLayoutId, switchWorkspace, saveWorkspace } = useClef();
  return { activeWorkspaceId, activeSplitLayoutId, switchWorkspace, saveWorkspace };
}

export function useKernelInvoke() {
  const { invoke } = useClef();
  return invoke;
}
