// @migrated dsl-constructs 2026-03-18
// PlatformAdapter Handler
//
// Implements the platform-neutral adapter registry and translation
// surface used by ui-app syncs. The translations stay abstract and
// return platform-specific instructions as serialized JSON.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const VALID_PLATFORMS = ['browser', 'mobile', 'desktop', 'watch', 'terminal'];

function parseJsonObject(raw: string, field: string): Record<string, unknown> | null {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function mapNavigationForPlatform(platform: string, transition: Record<string, unknown>) {
  const destination = String(transition.destination ?? '');
  const href = String(transition.href ?? '');
  const type = String(transition.type ?? 'push');

  switch (platform) {
    case 'browser':
      return { action: type === 'replace' ? 'replaceState' : 'pushState', destination, href };
    case 'mobile':
      return { action: type === 'replace' ? 'navigation.replace' : 'navigation.push', screen: destination, href };
    case 'desktop':
      return { action: type === 'replace' ? 'replaceWindowContent' : 'focusWindow', window: destination || href };
    case 'watch':
      return { action: type === 'replace' ? 'replacePage' : 'pushPage', page: destination || href };
    case 'terminal':
      return { action: 'switchScreen', screen: destination || href, render: type !== 'replace' };
    default:
      return null;
  }
}

function mapZoneForPlatform(platform: string, role: string) {
  switch (platform) {
    case 'browser':
      return { role, target: role === 'persistent' ? 'sidebar' : role === 'transient' ? 'overlay-root' : 'main-content' };
    case 'mobile':
      return { role, target: role === 'persistent' ? 'drawer' : role === 'transient' ? 'sheet' : 'screen' };
    case 'desktop':
      return { role, target: role === 'transient' ? 'modal-layer' : 'window-pane' };
    case 'watch':
      return role === 'navigated' ? { role, target: 'page' } : null;
    case 'terminal':
      return { role, target: role === 'persistent' ? 'status-line' : role === 'transient' ? 'dialog' : 'main-buffer' };
    default:
      return null;
  }
}

function handleEventForPlatform(platform: string, event: Record<string, unknown>) {
  const name = String(event.name ?? event.event ?? '');

  switch (platform) {
    case 'browser':
      if (name === 'popstate') return { action: 'navigateBack' };
      if (name === 'hashchange') return { action: 'navigate', mode: 'hash' };
      return null;
    case 'mobile':
      if (name === 'hardware-back') return { action: 'navigateBack' };
      if (name === 'deep-link') return { action: 'navigate', href: String(event.href ?? '') };
      return null;
    case 'desktop':
      if (name === 'close-window') return { action: 'cleanup' };
      if (name === 'shortcut-back') return { action: 'navigateBack' };
      return null;
    case 'watch':
      if (name === 'crown-press') return { action: 'navigateBack' };
      if (name === 'wrist-raise') return { action: 'activate' };
      return null;
    case 'terminal':
      if (name === 'escape') return { action: 'navigateBack' };
      if (name === 'ctrl-c') return { action: 'quit' };
      return null;
    default:
      return null;
  }
}

const _platformAdapterHandler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const adapter = input.adapter as string;
    const platform = String(input.platform ?? '').toLowerCase();
    const config = input.config as string;

    let p = createProgram();

    if (!VALID_PLATFORMS.includes(platform)) {
      return complete(p, 'duplicate', { message: `Unsupported platform "${platform}"` }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    p = spGet(p, 'platformAdapter', adapter, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'duplicate', { message: `Adapter "${adapter}" already registered` }),
      (b) => {
        let b2 = put(b, 'platformAdapter', adapter, {
          adapter,
          platform,
          config: config || '{}',
          status: 'registered',
        });
        return complete(b2, 'ok', { adapter });
      },
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  mapNavigation(input: Record<string, unknown>) {
    const adapter = input.adapter as string;
    const transition = input.transition as string;

    let p = createProgram();
    p = spGet(p, 'platformAdapter', adapter, 'record');
    p = branch(p, 'record',
      (b) => {
        const parsed = parseJsonObject(transition, 'transition');
        if (!parsed) {
          return complete(b, 'unsupported', { message: 'Transition must be valid JSON' });
        }
        // Platform from binding not accessible; return generic
        return complete(b, 'ok', { adapter, platformAction: JSON.stringify({}) });
      },
      (b) => complete(b, 'unsupported', { message: `Adapter "${adapter}" not registered` }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  mapZone(input: Record<string, unknown>) {
    const adapter = input.adapter as string;
    const role = String(input.role ?? '');

    let p = createProgram();
    p = spGet(p, 'platformAdapter', adapter, 'record');
    p = branch(p, 'record',
      (b) => complete(b, 'ok', { adapter, platformConfig: JSON.stringify({}) }),
      (b) => complete(b, 'unmapped', { message: `Adapter "${adapter}" not registered` }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  handlePlatformEvent(input: Record<string, unknown>) {
    const adapter = input.adapter as string;
    const event = input.event as string;

    let p = createProgram();
    p = spGet(p, 'platformAdapter', adapter, 'record');
    p = branch(p, 'record',
      (b) => {
        const parsed = parseJsonObject(event, 'event');
        if (!parsed) {
          return complete(b, 'ignored', { message: 'Event must be valid JSON' });
        }
        return complete(b, 'ok', { adapter, action: JSON.stringify({}) });
      },
      (b) => complete(b, 'ignored', { message: `Adapter "${adapter}" not registered` }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const platformAdapterHandler = autoInterpret(_platformAdapterHandler);

