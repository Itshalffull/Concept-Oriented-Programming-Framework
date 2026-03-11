import { describe, expect, it } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { sessionHandler } from '../../handlers/ts/app/session.handler.js';

describe('sessionHandler', () => {
  it('creates a session id when one is not supplied', async () => {
    const storage = createInMemoryStorage();

    const result = await sessionHandler.create(
      {
        userId: 'admin',
        device: 'browser',
      },
      storage,
    );

    expect(result.variant).toBe('ok');
    expect(typeof result.session).toBe('string');
    expect(String(result.session).length).toBeGreaterThan(0);

    const record = await storage.get('session', String(result.session));
    expect(record?.userId).toBe('admin');
    expect(record?.device).toBe('browser');
  });
});
