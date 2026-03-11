import { describe, expect, it } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { shellHandler } from '../../handlers/ts/app/shell.handler.js';

describe('shellHandler', () => {
  it('initializes shell zones from named zone objects', async () => {
    const storage = createInMemoryStorage();

    const result = await shellHandler.initialize(
      {
        shell: 'shell-1',
        zones: JSON.stringify([
          { name: 'sidebar', role: 'persistent' },
          { name: 'primary', role: 'navigated' },
        ]),
      },
      storage,
    );

    expect(result.variant).toBe('ok');
    const record = await storage.get('shell', 'shell-1');
    expect(record?.status).toBe('ready');
    expect(JSON.parse(String(record?.zones))).toEqual({
      sidebar: '',
      primary: '',
    });
    expect(JSON.parse(String(record?.zoneRole))).toEqual({
      sidebar: 'persistent',
      primary: 'navigated',
    });
  });
});
