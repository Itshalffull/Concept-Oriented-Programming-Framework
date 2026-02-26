// PlatformAdapter Concept Implementation
// Platform-specific translation layer for Navigator and Shell.
import type { ConceptHandler } from '../../../runtime/types.js';

const RELATION = 'platformadapter';

const VALID_PLATFORMS = ['browser', 'mobile', 'watch', 'desktop', 'terminal'] as const;

/** Auto-detect capabilities based on platform. */
function detectCapabilities(platform: string): string[] {
  switch (platform) {
    case 'browser':
      return ['url-bar', 'back-gesture', 'multi-tab', 'resize', 'deep-link'];
    case 'mobile':
      return ['back-gesture', 'haptic', 'deep-link', 'push-notification', 'biometric'];
    case 'watch':
      return ['crown', 'haptic', 'single-focus', 'auto-save'];
    case 'desktop':
      return ['multi-window', 'menubar', 'keyboard-shortcut', 'resize', 'tray'];
    case 'terminal':
      return ['keyboard', 'text-only'];
    default:
      return [];
  }
}

export const platformadapterHandler: ConceptHandler = {
  /**
   * register(adapter, platform, config)
   *   -> ok(adapter) | conflict(message)
   */
  async register(input, storage) {
    const adapter = input.adapter as string;
    const platform = input.platform as string;
    const config = input.config as string;

    if (!VALID_PLATFORMS.includes(platform as typeof VALID_PLATFORMS[number])) {
      return {
        variant: 'conflict',
        message: `Invalid platform "${platform}". Valid platforms: ${VALID_PLATFORMS.join(', ')}`,
      };
    }

    // Check for existing adapter for this platform
    const existing = await storage.find(RELATION, { platform });
    if (existing.length > 0) {
      return {
        variant: 'conflict',
        message: `An adapter for platform "${platform}" is already registered`,
      };
    }

    const capabilities = detectCapabilities(platform);

    await storage.put(RELATION, adapter, {
      adapter,
      platform,
      capabilities: JSON.stringify(capabilities),
      config,
      status: 'active',
    });

    return { variant: 'ok', adapter };
  },

  /**
   * mapNavigation(adapter, transition)
   *   -> ok(adapter) | unsupported(message)
   */
  async mapNavigation(input, storage) {
    const adapter = input.adapter as string;
    const transition = input.transition as string;

    const record = await storage.get(RELATION, adapter);
    if (!record) {
      return {
        variant: 'unsupported',
        message: `Adapter "${adapter}" not found`,
      };
    }

    let parsedTransition: Record<string, unknown>;
    try {
      parsedTransition = JSON.parse(transition) as Record<string, unknown>;
    } catch {
      return { variant: 'unsupported', message: 'Transition is not valid JSON' };
    }

    // Platform-specific navigation mapping is handled by the actual
    // platform runtime. The concept implementation validates and acknowledges.
    return { variant: 'ok', adapter };
  },

  /**
   * mapZone(adapter, zone, role)
   *   -> ok(adapter, platformZone) | unmapped(message)
   */
  async mapZone(input, storage) {
    const adapter = input.adapter as string;
    const zone = input.zone as string;
    const role = input.role as string;

    const record = await storage.get(RELATION, adapter);
    if (!record) {
      return { variant: 'unmapped', message: `Adapter "${adapter}" not found` };
    }

    const platform = record.platform as string;

    // Platform-specific zone mapping
    const zoneMap: Record<string, Record<string, string>> = {
      browser: {
        navigated: 'main-content',
        persistent: 'sidebar',
        transient: 'notification-area',
      },
      mobile: {
        navigated: 'stack-screen',
        persistent: 'bottom-tab-bar',
        transient: 'toast',
      },
      watch: {
        navigated: 'full-screen',
      },
      desktop: {
        navigated: 'main-window',
        persistent: 'panel',
        transient: 'notification',
      },
      terminal: {
        navigated: 'main-buffer',
        persistent: 'status-line',
      },
    };

    const platformZones = zoneMap[platform] ?? {};
    const platformZone = platformZones[role];

    if (!platformZone) {
      return {
        variant: 'unmapped',
        message: `Role "${role}" has no equivalent on platform "${platform}"`,
      };
    }

    return {
      variant: 'ok',
      adapter,
      platformZone: JSON.stringify({ zone, role, platform: platformZone }),
    };
  },

  /**
   * mapOverlay(adapter, overlay)
   *   -> ok(adapter) | unsupported(message)
   */
  async mapOverlay(input, storage) {
    const adapter = input.adapter as string;
    const overlay = input.overlay as string;

    const record = await storage.get(RELATION, adapter);
    if (!record) {
      return { variant: 'unsupported', message: `Adapter "${adapter}" not found` };
    }

    const platform = record.platform as string;

    // Some platforms don't support overlays
    if (platform === 'terminal') {
      // Terminal supports basic floating box overlays
    }

    return { variant: 'ok', adapter };
  },

  /**
   * handlePlatformEvent(adapter, event)
   *   -> ok(adapter, action) | ignored(message)
   */
  async handlePlatformEvent(input, storage) {
    const adapter = input.adapter as string;
    const event = input.event as string;

    const record = await storage.get(RELATION, adapter);
    if (!record) {
      return { variant: 'ignored', message: `Adapter "${adapter}" not found` };
    }

    let parsedEvent: Record<string, unknown>;
    try {
      parsedEvent = JSON.parse(event) as Record<string, unknown>;
    } catch {
      return { variant: 'ignored', message: 'Event is not valid JSON' };
    }

    const eventType = parsedEvent.type as string;
    const platform = record.platform as string;

    // Map platform events to navigator actions
    const backEvents: Record<string, string[]> = {
      browser: ['popstate'],
      mobile: ['hardware-back', 'swipe-back'],
      watch: ['crown-press'],
      desktop: ['cmd-[', 'alt-left'],
      terminal: ['escape'],
    };

    const platformBackEvents = backEvents[platform] ?? [];
    if (platformBackEvents.includes(eventType)) {
      return {
        variant: 'ok',
        adapter,
        action: JSON.stringify({ type: 'back' }),
      };
    }

    return {
      variant: 'ignored',
      message: `Event "${eventType}" is not relevant on platform "${platform}"`,
    };
  },
};
