import { describe, expect, it } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { platformBindingCatalogHandler } from '../../handlers/ts/app/platform-binding-catalog.handler.js';

describe('platformBindingCatalogHandler', () => {
  it('resolves an exact destination binding before wildcard fallback', async () => {
    const storage = createInMemoryStorage();

    await platformBindingCatalogHandler.register({
      binding: 'binding:browser:navigation:*',
      platform: 'browser',
      destinationPattern: '*',
      bindingKind: 'navigation',
      payload: '{"type":"push","target":"href"}',
    }, storage);

    await platformBindingCatalogHandler.register({
      binding: 'binding:browser:navigation:dashboard',
      platform: 'browser',
      destinationPattern: 'dashboard',
      bindingKind: 'navigation',
      payload: '{"type":"replace","target":"href"}',
    }, storage);

    const exact = await platformBindingCatalogHandler.resolve({
      platform: 'browser',
      destination: 'dashboard',
      bindingKind: 'navigation',
    }, storage);

    expect(exact).toMatchObject({
      variant: 'ok',
      binding: 'binding:browser:navigation:dashboard',
      matchedPattern: 'dashboard',
      payload: '{"type":"replace","target":"href"}',
    });

    const wildcard = await platformBindingCatalogHandler.resolve({
      platform: 'browser',
      destination: 'content',
      bindingKind: 'navigation',
    }, storage);

    expect(wildcard).toMatchObject({
      variant: 'ok',
      binding: 'binding:browser:navigation:*',
      matchedPattern: '*',
    });
  });

  it('lists platform bindings with optional platform filtering', async () => {
    const storage = createInMemoryStorage();

    await platformBindingCatalogHandler.register({
      binding: 'binding:browser:navigation:*',
      platform: 'browser',
      destinationPattern: '*',
      bindingKind: 'navigation',
      payload: '{"type":"push","target":"href"}',
    }, storage);

    await platformBindingCatalogHandler.register({
      binding: 'binding:desktop:navigation:*',
      platform: 'desktop',
      destinationPattern: '*',
      bindingKind: 'navigation',
      payload: '{"type":"focus","target":"window"}',
    }, storage);

    const browserOnly = await platformBindingCatalogHandler.list({
      platform: 'browser',
    }, storage);

    expect(browserOnly.bindings).toEqual([
      expect.objectContaining({ platform: 'browser' }),
    ]);
  });
});
