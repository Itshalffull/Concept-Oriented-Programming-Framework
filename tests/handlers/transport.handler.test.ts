import { describe, expect, it } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { transportHandler } from '../../handlers/ts/app/transport.handler.js';

describe('transportHandler', () => {
  it('defaults the base URL when configure is called without one', async () => {
    const storage = createInMemoryStorage();

    const result = await transportHandler.configure(
      {
        transport: 'transport-1',
        kind: 'rest',
      },
      storage,
    );

    expect(result.variant).toBe('ok');
    const record = await storage.get('transport', 'transport-1');
    expect(record?.baseUrl).toBe('/api/invoke');
    expect(record?.status).toBe('configured');
  });

  it('sets and clears auth without losing transport configuration', async () => {
    const storage = createInMemoryStorage();

    await transportHandler.configure(
      {
        transport: 'transport-2',
        kind: 'rest',
        baseUrl: '/api/invoke',
      },
      storage,
    );

    const setAuth = await transportHandler.setAuth(
      {
        transport: 'transport-2',
        auth: 'token-123',
      },
      storage,
    );
    expect(setAuth.variant).toBe('ok');
    expect((await storage.get('transport', 'transport-2'))?.auth).toBe('token-123');

    const clearAuth = await transportHandler.clearAuth(
      {
        transport: 'transport-2',
      },
      storage,
    );
    expect(clearAuth.variant).toBe('ok');
    const record = await storage.get('transport', 'transport-2');
    expect(record?.auth).toBe('');
    expect(record?.baseUrl).toBe('/api/invoke');
  });
});
