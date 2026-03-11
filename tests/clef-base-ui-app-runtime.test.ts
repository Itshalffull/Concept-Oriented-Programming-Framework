import { describe, expect, it } from 'vitest';
import {
  bootstrapUiApp,
  createInitialUiAppSnapshot,
  markHostReady,
  syncPathToUiApp,
} from '../clef-base/lib/ui-app-runtime.js';
import type { Destination } from '../clef-base/lib/destinations.js';

const destinations: Destination[] = [
  {
    destination: 'dashboard',
    name: 'dashboard',
    targetConcept: 'AppShell',
    targetView: 'dashboard',
    href: '/admin',
    icon: 'home',
    group: 'Content',
  },
  {
    destination: 'content',
    name: 'content',
    targetConcept: 'ContentNode',
    targetView: 'list',
    href: '/admin/content',
    icon: 'doc',
    group: 'Content',
  },
];

describe('clef-base ui-app runtime', () => {
  it('bootstraps the shell, transport, and platform adapter', async () => {
    const calls: Array<{ concept: string; action: string; input: Record<string, unknown> }> = [];
    const invoke = async (concept: string, action: string, input: Record<string, unknown>) => {
      calls.push({ concept, action, input });
      if (concept === 'RuntimeProfile' && action === 'resolve') {
        return {
          variant: 'ok',
          profile: 'runtime-profile:clef-base-admin',
          name: 'clef-base-admin',
          shellId: 'clef-base-shell',
          navigatorId: 'clef-base-navigator',
          transportId: 'clef-base-transport',
          platformAdapterId: 'clef-base-platform',
          platform: 'browser',
          router: 'app-router',
          baseUrl: '/api/invoke',
          retryPolicy: '{"maxAttempts":3,"backoff":"exponential"}',
          authMode: 'cookie',
        };
      }
      return { variant: 'ok' };
    };

    const snapshot = await bootstrapUiApp(invoke);

    expect(snapshot.runtimeProfile?.name).toBe('clef-base-admin');
    expect(snapshot.shell.status).toBe('ready');
    expect(calls[0]).toMatchObject({ concept: 'RuntimeProfile', action: 'resolve' });
    expect(calls[1]).toMatchObject({ concept: 'Shell', action: 'initialize' });
    expect(calls[2]).toMatchObject({ concept: 'Transport', action: 'configure' });
    expect(calls[3]).toMatchObject({ concept: 'PlatformAdapter', action: 'register' });
  });

  it('syncs a route destination through navigator, host, and shell', async () => {
    const calls: Array<{ concept: string; action: string; input: Record<string, unknown> }> = [];
    const invoke = async (concept: string, action: string, input: Record<string, unknown>) => {
      calls.push({ concept, action, input });
      if (concept === 'PlatformBindingCatalog' && action === 'resolve') {
        return {
          variant: 'ok',
          binding: 'binding:browser:navigation:*',
          payload: '{"type":"push","target":"href"}',
          matchedPattern: '*',
        };
      }
      return { variant: 'ok' };
    };

    const snapshot = await syncPathToUiApp(invoke, createInitialUiAppSnapshot(), destinations[1]);

    expect(snapshot.navigator.current?.name).toBe(destinations[1].name);
    expect(snapshot.currentHost?.concept).toBe(destinations[1].targetConcept);
    expect(snapshot.shell.zones.primary).toBe(snapshot.currentHost?.id);
    expect(calls.map((call) => `${call.concept}/${call.action}`)).toEqual([
      'RuntimeProfile/resolve',
      'PlatformBindingCatalog/resolve',
      'Navigator/go',
      'PlatformAdapter/mapNavigation',
      'Host/mount',
      'Shell/assignToZone',
    ]);
  });

  it('marks the active host ready', async () => {
    const destination = destinations[0];
    const invoke = async (concept: string, action: string) => {
      if (concept === 'PlatformBindingCatalog' && action === 'resolve') {
        return {
          variant: 'ok',
          binding: 'binding:browser:navigation:*',
          payload: '{"type":"push","target":"href"}',
          matchedPattern: '*',
        };
      }
      return { variant: 'ok' };
    };
    const mounted = await syncPathToUiApp(invoke, createInitialUiAppSnapshot(), destination);

    const ready = await markHostReady(invoke, mounted, String(mounted.currentHost?.id));

    expect(ready.currentHost?.status).toBe('ready');
  });
});
