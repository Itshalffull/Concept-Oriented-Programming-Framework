import { describe, expect, it } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { destinationCatalogHandler } from '../../handlers/ts/app/destination-catalog.handler.js';

describe('destinationCatalogHandler', () => {
  it('registers and resolves destinations by name', async () => {
    const storage = createInMemoryStorage();

    const registered = await destinationCatalogHandler.register({
      destination: 'dashboard',
      name: 'dashboard',
      targetConcept: 'AppShell',
      targetView: 'dashboard',
      href: '/admin',
      icon: 'home',
      group: 'Content',
    }, storage);

    expect(registered.variant).toBe('ok');

    const resolved = await destinationCatalogHandler.resolveByName({
      name: 'dashboard',
    }, storage);

    expect(resolved).toMatchObject({
      variant: 'ok',
      destination: 'dashboard',
      href: '/admin',
      targetConcept: 'AppShell',
    });
  });

  it('matches nested hrefs against their base destination', async () => {
    const storage = createInMemoryStorage();

    await destinationCatalogHandler.register({
      destination: 'content',
      name: 'content',
      targetConcept: 'ContentNode',
      targetView: 'list',
      href: '/admin/content',
      icon: 'doc',
      group: 'Content',
    }, storage);

    const resolved = await destinationCatalogHandler.resolveByHref({
      href: '/admin/content/article-1',
    }, storage);

    expect(resolved).toMatchObject({
      variant: 'ok',
      destination: 'content',
      name: 'content',
    });
  });
});
