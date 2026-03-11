import { describe, expect, it } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { runtimeProfileHandler } from '../../handlers/ts/app/runtime-profile.handler.js';

describe('runtimeProfileHandler', () => {
  it('registers and resolves a runtime profile by name', async () => {
    const storage = createInMemoryStorage();

    const registered = await runtimeProfileHandler.register({
      profile: 'runtime-profile:browser-admin',
      name: 'browser-admin',
      shellId: 'shell-1',
      navigatorId: 'nav-1',
      transportId: 'transport-1',
      platformAdapterId: 'platform-1',
      platform: 'browser',
      router: 'app-router',
      baseUrl: '/api/invoke',
      retryPolicy: '{"maxAttempts":3,"backoff":"exponential"}',
      authMode: 'cookie',
    }, storage);

    expect(registered).toMatchObject({
      variant: 'ok',
      profile: 'runtime-profile:browser-admin',
    });

    const resolved = await runtimeProfileHandler.resolve({
      name: 'browser-admin',
    }, storage);

    expect(resolved).toMatchObject({
      variant: 'ok',
      profile: 'runtime-profile:browser-admin',
      shellId: 'shell-1',
      transportId: 'transport-1',
      authMode: 'cookie',
    });
  });

  it('lists all declared runtime profiles', async () => {
    const storage = createInMemoryStorage();

    await runtimeProfileHandler.register({
      profile: 'runtime-profile:browser-admin',
      name: 'browser-admin',
      shellId: 'shell-1',
      navigatorId: 'nav-1',
      transportId: 'transport-1',
      platformAdapterId: 'platform-1',
      platform: 'browser',
      router: 'app-router',
      baseUrl: '/api/invoke',
      retryPolicy: '{"maxAttempts":3,"backoff":"exponential"}',
    }, storage);

    await runtimeProfileHandler.register({
      profile: 'runtime-profile:desktop-admin',
      name: 'desktop-admin',
      shellId: 'shell-2',
      navigatorId: 'nav-2',
      transportId: 'transport-2',
      platformAdapterId: 'platform-2',
      platform: 'desktop',
      router: 'window-router',
      baseUrl: 'desktop://invoke',
      retryPolicy: '{"maxAttempts":2,"backoff":"linear"}',
    }, storage);

    const listed = await runtimeProfileHandler.list({}, storage);

    expect(listed.profiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'browser-admin', platform: 'browser' }),
        expect.objectContaining({ name: 'desktop-admin', platform: 'desktop' }),
      ]),
    );
  });
});
