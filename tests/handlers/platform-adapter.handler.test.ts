import { describe, expect, it } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { platformAdapterHandler } from '../../handlers/ts/app/platform-adapter.handler.js';

describe('platformAdapterHandler', () => {
  it('registers a browser adapter and maps navigation', async () => {
    const storage = createInMemoryStorage();

    const registered = await platformAdapterHandler.register(
      {
        adapter: 'platform-1',
        platform: 'browser',
        config: '{}',
      },
      storage,
    );

    expect(registered.variant).toBe('ok');

    const mapped = await platformAdapterHandler.mapNavigation(
      {
        adapter: 'platform-1',
        transition: JSON.stringify({
          type: 'push',
          destination: 'content',
          href: '/admin/content',
        }),
      },
      storage,
    );

    expect(mapped.variant).toBe('ok');
    expect(JSON.parse(String(mapped.platformAction))).toEqual({
      action: 'pushState',
      destination: 'content',
      href: '/admin/content',
    });
  });

  it('maps zones and platform events for the registered platform', async () => {
    const storage = createInMemoryStorage();

    await platformAdapterHandler.register(
      {
        adapter: 'platform-2',
        platform: 'terminal',
        config: '{}',
      },
      storage,
    );

    const zone = await platformAdapterHandler.mapZone(
      {
        adapter: 'platform-2',
        role: 'persistent',
      },
      storage,
    );
    expect(zone.variant).toBe('ok');
    expect(JSON.parse(String(zone.platformConfig))).toEqual({
      role: 'persistent',
      target: 'status-line',
    });

    const event = await platformAdapterHandler.handlePlatformEvent(
      {
        adapter: 'platform-2',
        event: JSON.stringify({ name: 'escape' }),
      },
      storage,
    );
    expect(event.variant).toBe('ok');
    expect(JSON.parse(String(event.action))).toEqual({
      action: 'navigateBack',
    });
  });
});
