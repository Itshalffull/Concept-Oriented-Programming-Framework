import { describe, expect, it } from 'vitest';
import { shellHandler } from '../../handlers/ts/app/shell.handler.js';

function createStorage() {
  const data = new Map<string, Map<string, Record<string, unknown>>>();
  const relation = (name: string) => {
    if (!data.has(name)) data.set(name, new Map());
    return data.get(name)!;
  };

  return {
    async put(name: string, key: string, value: Record<string, unknown>) {
      relation(name).set(key, { ...value });
    },
    async get(name: string, key: string) {
      const value = relation(name).get(key);
      return value ? { ...value } : null;
    },
  };
}

describe('shellHandler adapt', () => {
  it('adapts shell zones while preserving existing assignments', async () => {
    const storage = createStorage();

    const init = await shellHandler.initialize!(
      { shell: 'shell-1', zones: JSON.stringify(['navigation', 'content']) },
      storage as never,
    );
    expect(init.variant).toBe('ok');

    await shellHandler.assignToZone!(
      { shell: 'shell-1', zone: 'content', ref: 'host-1' },
      storage as never,
    );

    const adapt = await shellHandler.adapt!(
      {
        shell: 'shell-1',
        config: JSON.stringify({
          zones: [
            { name: 'navigation', role: 'persistent' },
            { name: 'content', role: 'navigated' },
            { name: 'utility', role: 'persistent' },
          ],
        }),
      },
      storage as never,
    );

    expect(adapt.variant).toBe('ok');

    const stored = await storage.get('shell', 'shell-1');
    expect(stored?.status).toBe('adapted');
    expect(JSON.parse(stored?.zones as string)).toEqual({
      navigation: '',
      content: 'host-1',
      utility: '',
    });
    expect(JSON.parse(stored?.zoneRole as string)).toEqual({
      navigation: 'persistent',
      content: 'navigated',
      utility: 'persistent',
    });
  });
});
