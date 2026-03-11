import { describe, expect, it } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { resourceGrantPolicyHandler } from '../../handlers/ts/app/resource-grant-policy.handler.js';

describe('resourceGrantPolicyHandler', () => {
  it('stores exact grants and resolves them before wildcard defaults', async () => {
    const storage = createInMemoryStorage();

    await resourceGrantPolicyHandler.setGrant({
      grant: 'schema:*:view',
      scope: 'schema',
      resourcePattern: '*',
      actionName: 'view',
      roles: ['viewer'],
    }, storage);

    await resourceGrantPolicyHandler.setGrant({
      grant: 'schema:Article:view',
      scope: 'schema',
      resourcePattern: 'Article',
      actionName: 'view',
      roles: ['admin', 'editor'],
    }, storage);

    const resolved = await resourceGrantPolicyHandler.resolve({
      scope: 'schema',
      resource: 'Article',
      actionName: 'view',
    }, storage);

    expect(resolved).toMatchObject({
      variant: 'ok',
      matchedPattern: 'Article',
      roles: ['admin', 'editor'],
    });
  });

  it('falls back to wildcard grants when no exact grant exists', async () => {
    const storage = createInMemoryStorage();

    await resourceGrantPolicyHandler.setGrant({
      grant: 'node:*:edit',
      scope: 'node',
      resourcePattern: '*',
      actionName: 'edit',
      roles: '["admin","editor"]',
    }, storage);

    const resolved = await resourceGrantPolicyHandler.resolve({
      scope: 'node',
      resource: 'article-1',
      actionName: 'edit',
    }, storage);

    expect(resolved).toMatchObject({
      variant: 'ok',
      matchedPattern: '*',
      roles: ['admin', 'editor'],
    });
  });
});
