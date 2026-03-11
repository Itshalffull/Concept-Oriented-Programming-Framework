import type { Destination } from './destinations';

export interface NavigatorSnapshot {
  current: Destination | null;
  history: Destination[];
  canGoBack: boolean;
  canGoForward: boolean;
}

export interface ShellSnapshot {
  zones: Record<string, string>;
  status: 'initializing' | 'ready' | 'error';
  overlays: string[];
}

export interface HostSnapshot {
  id: string;
  concept: string;
  view: string;
  zone: string;
  status: 'mounting' | 'mounted' | 'ready' | 'error' | 'unmounted';
}

export interface RuntimeProfileSnapshot {
  profile: string;
  name: string;
  shellId: string;
  navigatorId: string;
  transportId: string;
  platformAdapterId: string;
  platform: string;
  router: string;
  baseUrl: string;
  retryPolicy: string;
  authMode: string | null;
}

export interface UiAppSnapshot {
  runtimeProfile: RuntimeProfileSnapshot | null;
  navigator: NavigatorSnapshot;
  shell: ShellSnapshot;
  currentHost: HostSnapshot | null;
}

export type KernelInvoker = (
  concept: string,
  action: string,
  input: Record<string, unknown>,
) => Promise<Record<string, unknown>>;

export const UI_APP_IDS = {
  shell: 'clef-base-shell',
  navigator: 'clef-base-navigator',
  transport: 'clef-base-transport',
  platformAdapter: 'clef-base-platform',
} as const;
export const DEFAULT_RUNTIME_PROFILE_NAME = 'clef-base-admin';

const SHELL_ZONES = ['sidebar', 'primary', 'overlay'] as const;

function hostIdFor(destination: Destination) {
  return `host:${destination.name}`;
}

function buildNavigatorSnapshot(
  current: Destination | null,
  history: Destination[],
  forward: Destination[],
): NavigatorSnapshot {
  return {
    current,
    history,
    canGoBack: history.length > 0,
    canGoForward: forward.length > 0,
  };
}

function buildHostSnapshot(destination: Destination): HostSnapshot {
  return {
    id: hostIdFor(destination),
    concept: destination.targetConcept,
    view: destination.targetView,
    zone: 'primary',
    status: 'mounted',
  };
}

function buildFallbackRuntimeProfile(): RuntimeProfileSnapshot {
  return {
    profile: 'runtime-profile:fallback',
    name: DEFAULT_RUNTIME_PROFILE_NAME,
    shellId: UI_APP_IDS.shell,
    navigatorId: UI_APP_IDS.navigator,
    transportId: UI_APP_IDS.transport,
    platformAdapterId: UI_APP_IDS.platformAdapter,
    platform: 'browser',
    router: 'app-router',
    baseUrl: '/api/invoke',
    retryPolicy: JSON.stringify({ maxAttempts: 3, backoff: 'exponential' }),
    authMode: 'cookie',
  };
}

async function resolveRuntimeProfile(
  invoke: KernelInvoker,
  name = DEFAULT_RUNTIME_PROFILE_NAME,
): Promise<RuntimeProfileSnapshot> {
  const response = await invoke('RuntimeProfile', 'resolve', { name });
  if (response.variant !== 'ok') {
    return buildFallbackRuntimeProfile();
  }

  return {
    profile: String(response.profile ?? ''),
    name: String(response.name ?? name),
    shellId: String(response.shellId ?? UI_APP_IDS.shell),
    navigatorId: String(response.navigatorId ?? UI_APP_IDS.navigator),
    transportId: String(response.transportId ?? UI_APP_IDS.transport),
    platformAdapterId: String(response.platformAdapterId ?? UI_APP_IDS.platformAdapter),
    platform: String(response.platform ?? 'browser'),
    router: String(response.router ?? 'app-router'),
    baseUrl: String(response.baseUrl ?? '/api/invoke'),
    retryPolicy: String(
      response.retryPolicy ?? JSON.stringify({ maxAttempts: 3, backoff: 'exponential' }),
    ),
    authMode: typeof response.authMode === 'string' && response.authMode.trim()
      ? response.authMode
      : null,
  };
}

async function resolveNavigationTransition(
  invoke: KernelInvoker,
  profile: RuntimeProfileSnapshot,
  destination: Destination,
  previous: Destination | null,
): Promise<{ type: string; destination: string; href: string }> {
  const fallback = {
    type: previous ? 'push' : 'replace',
    destination: destination.name,
    href: destination.href,
  };

  const response = await invoke('PlatformBindingCatalog', 'resolve', {
    platform: profile.platform,
    destination: destination.name,
    bindingKind: 'navigation',
  });

  if (response.variant !== 'ok' || typeof response.payload !== 'string') {
    return fallback;
  }

  try {
    const payload = JSON.parse(response.payload) as Record<string, unknown>;
    return {
      ...fallback,
      type: typeof payload.type === 'string' && payload.type.trim()
        ? payload.type
        : fallback.type,
    };
  } catch {
    return fallback;
  }
}

export function createInitialUiAppSnapshot(): UiAppSnapshot {
  return {
    runtimeProfile: null,
    navigator: buildNavigatorSnapshot(null, [], []),
    shell: {
      zones: Object.fromEntries(SHELL_ZONES.map((zone) => [zone, ''])),
      status: 'initializing',
      overlays: [],
    },
    currentHost: null,
  };
}

export async function bootstrapUiApp(
  invoke: KernelInvoker,
): Promise<UiAppSnapshot> {
  const runtimeProfile = await resolveRuntimeProfile(invoke);

  await invoke('Shell', 'initialize', {
    shell: runtimeProfile.shellId,
    zones: JSON.stringify(
      SHELL_ZONES.map((name) => ({
        name,
        role:
          name === 'sidebar'
            ? 'persistent'
            : name === 'overlay'
              ? 'transient'
              : 'navigated',
      })),
    ),
  });

  await invoke('Transport', 'configure', {
    transport: runtimeProfile.transportId,
    kind: 'rest',
    baseUrl: runtimeProfile.baseUrl,
    auth: runtimeProfile.authMode ?? undefined,
    retryPolicy: runtimeProfile.retryPolicy,
  });

  await invoke('PlatformAdapter', 'register', {
    adapter: runtimeProfile.platformAdapterId,
    platform: runtimeProfile.platform,
    config: JSON.stringify({ runtime: 'nextjs', router: runtimeProfile.router }),
  });

  return {
    ...createInitialUiAppSnapshot(),
    runtimeProfile,
    shell: {
      zones: Object.fromEntries(SHELL_ZONES.map((zone) => [zone, ''])),
      status: 'ready',
      overlays: [],
    },
  };
}

export async function syncPathToUiApp(
  invoke: KernelInvoker,
  snapshot: UiAppSnapshot,
  destination: Destination,
): Promise<UiAppSnapshot> {
  const runtimeProfile = snapshot.runtimeProfile ?? await resolveRuntimeProfile(invoke);
  const previous = snapshot.navigator.current;
  const history =
    previous && previous.name !== destination.name
      ? [...snapshot.navigator.history, previous]
      : snapshot.navigator.history;
  const transition = await resolveNavigationTransition(invoke, runtimeProfile, destination, previous);

  await invoke('Navigator', 'go', {
    nav: runtimeProfile.navigatorId,
    params: JSON.stringify({
      destination: destination.name,
      href: destination.href,
    }),
  });

  await invoke('PlatformAdapter', 'mapNavigation', {
    adapter: runtimeProfile.platformAdapterId,
    transition: JSON.stringify(transition),
  });

  if (previous && previous.name !== destination.name) {
    await invoke('Host', 'unmount', { host: hostIdFor(previous) });
  }

  const host = buildHostSnapshot(destination);
  await invoke('Host', 'mount', {
    host: host.id,
    concept: host.concept,
    view: host.view,
    level: 0,
    zone: host.zone,
  });

  await invoke('Shell', 'assignToZone', {
    shell: runtimeProfile.shellId,
    zone: host.zone,
    ref: host.id,
  });

  return {
    runtimeProfile,
    navigator: buildNavigatorSnapshot(destination, history, []),
    shell: {
      ...snapshot.shell,
      status: 'ready',
      zones: {
        ...snapshot.shell.zones,
        primary: host.id,
      },
    },
    currentHost: host,
  };
}

export async function markHostReady(
  invoke: KernelInvoker,
  snapshot: UiAppSnapshot,
  hostId: string,
): Promise<UiAppSnapshot> {
  await invoke('Host', 'ready', { host: hostId });

  if (!snapshot.currentHost || snapshot.currentHost.id !== hostId) {
    return snapshot;
  }

  return {
    ...snapshot,
    currentHost: {
      ...snapshot.currentHost,
      status: 'ready',
    },
  };
}

export async function unmountHost(
  invoke: KernelInvoker,
  snapshot: UiAppSnapshot,
  hostId: string,
): Promise<UiAppSnapshot> {
  await invoke('Host', 'unmount', { host: hostId });

  if (!snapshot.currentHost || snapshot.currentHost.id !== hostId) {
    return snapshot;
  }

  return {
    ...snapshot,
    shell: {
      ...snapshot.shell,
      zones: {
        ...snapshot.shell.zones,
        [snapshot.currentHost.zone]: '',
      },
    },
    currentHost: {
      ...snapshot.currentHost,
      status: 'unmounted',
    },
  };
}
