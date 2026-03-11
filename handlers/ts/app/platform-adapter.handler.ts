// PlatformAdapter Handler
//
// Implements the platform-neutral adapter registry and translation
// surface used by ui-app syncs. The translations stay abstract and
// return platform-specific instructions as serialized JSON.

import type { ConceptHandler } from '@clef/runtime';

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
      return {
        action: type === 'replace' ? 'replaceState' : 'pushState',
        destination,
        href,
      };
    case 'mobile':
      return {
        action: type === 'replace' ? 'navigation.replace' : 'navigation.push',
        screen: destination,
        href,
      };
    case 'desktop':
      return {
        action: type === 'replace' ? 'replaceWindowContent' : 'focusWindow',
        window: destination || href,
      };
    case 'watch':
      return {
        action: type === 'replace' ? 'replacePage' : 'pushPage',
        page: destination || href,
      };
    case 'terminal':
      return {
        action: 'switchScreen',
        screen: destination || href,
        render: type !== 'replace',
      };
    default:
      return null;
  }
}

function mapZoneForPlatform(platform: string, role: string) {
  switch (platform) {
    case 'browser':
      return {
        role,
        target:
          role === 'persistent'
            ? 'sidebar'
            : role === 'transient'
              ? 'overlay-root'
              : 'main-content',
      };
    case 'mobile':
      return {
        role,
        target:
          role === 'persistent'
            ? 'drawer'
            : role === 'transient'
              ? 'sheet'
              : 'screen',
      };
    case 'desktop':
      return { role, target: role === 'transient' ? 'modal-layer' : 'window-pane' };
    case 'watch':
      return role === 'navigated' ? { role, target: 'page' } : null;
    case 'terminal':
      return {
        role,
        target: role === 'persistent' ? 'status-line' : role === 'transient' ? 'dialog' : 'main-buffer',
      };
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

export const platformAdapterHandler: ConceptHandler = {
  async register(input, storage) {
    const adapter = input.adapter as string;
    const platform = String(input.platform ?? '').toLowerCase();
    const config = input.config as string;

    if (!VALID_PLATFORMS.includes(platform)) {
      return { variant: 'duplicate', message: `Unsupported platform "${platform}"` };
    }

    const existing = await storage.get('platformAdapter', adapter);
    if (existing) {
      return { variant: 'duplicate', message: `Adapter "${adapter}" already registered` };
    }

    await storage.put('platformAdapter', adapter, {
      adapter,
      platform,
      config: config || '{}',
      status: 'registered',
    });

    return { variant: 'ok', adapter };
  },

  async mapNavigation(input, storage) {
    const adapter = input.adapter as string;
    const transition = input.transition as string;
    const record = await storage.get('platformAdapter', adapter);

    if (!record) {
      return { variant: 'unsupported', message: `Adapter "${adapter}" not registered` };
    }

    const parsed = parseJsonObject(transition, 'transition');
    if (!parsed) {
      return { variant: 'unsupported', message: 'Transition must be valid JSON' };
    }

    const mapped = mapNavigationForPlatform(String(record.platform), parsed);
    if (!mapped) {
      return { variant: 'unsupported', message: 'Transition type unsupported' };
    }

    return { variant: 'ok', adapter, platformAction: JSON.stringify(mapped) };
  },

  async mapZone(input, storage) {
    const adapter = input.adapter as string;
    const role = String(input.role ?? '');
    const record = await storage.get('platformAdapter', adapter);

    if (!record) {
      return { variant: 'unmapped', message: `Adapter "${adapter}" not registered` };
    }

    const mapped = mapZoneForPlatform(String(record.platform), role);
    if (!mapped) {
      return { variant: 'unmapped', message: `Role "${role}" has no platform equivalent` };
    }

    return { variant: 'ok', adapter, platformConfig: JSON.stringify(mapped) };
  },

  async handlePlatformEvent(input, storage) {
    const adapter = input.adapter as string;
    const event = input.event as string;
    const record = await storage.get('platformAdapter', adapter);

    if (!record) {
      return { variant: 'ignored', message: `Adapter "${adapter}" not registered` };
    }

    const parsed = parseJsonObject(event, 'event');
    if (!parsed) {
      return { variant: 'ignored', message: 'Event must be valid JSON' };
    }

    const mapped = handleEventForPlatform(String(record.platform), parsed);
    if (!mapped) {
      return { variant: 'ignored', message: 'Event not relevant' };
    }

    return { variant: 'ok', adapter, action: JSON.stringify(mapped) };
  },
};
