import { describe, expect, it } from 'vitest';
import { themeHandler } from '../handlers/ts/app/theme.handler.js';

function createStorage() {
  const data = new Map<string, Map<string, Record<string, unknown>>>();

  function relation(name: string) {
    if (!data.has(name)) data.set(name, new Map());
    return data.get(name)!;
  }

  return {
    async put(name: string, key: string, value: Record<string, unknown>) {
      relation(name).set(key, { ...value });
    },
    async get(name: string, key: string) {
      const value = relation(name).get(key);
      return value ? { ...value } : null;
    },
    async find(name: string, criteria?: Record<string, unknown>) {
      const records = Array.from(relation(name).entries()).map(([key, value]) => ({
        ...value,
        _key: key,
      }));
      if (!criteria || Object.keys(criteria).length === 0) {
        return records;
      }
      return records.filter((record) =>
        Object.entries(criteria).every(([key, value]) => record[key] === value),
      );
    },
  };
}

describe('themeHandler', () => {
  it('keeps one theme active when the first theme is created', async () => {
    const storage = createStorage();

    await themeHandler.create!({ theme: 'light', name: 'Light', overrides: '{}' }, storage as never);
    await themeHandler.create!({ theme: 'dark', name: 'Dark', overrides: '{}' }, storage as never);

    const light = await storage.get('theme', 'light');
    const dark = await storage.get('theme', 'dark');

    expect(light?.active).toBe(true);
    expect(dark?.active).toBe(false);
  });

  it('activates a single selected theme and deactivates the rest', async () => {
    const storage = createStorage();

    await themeHandler.create!({ theme: 'light', name: 'Light', overrides: '{}' }, storage as never);
    await themeHandler.create!({ theme: 'dark', name: 'Dark', overrides: '{}' }, storage as never);
    await themeHandler.activate!({ theme: 'dark', priority: 100 }, storage as never);

    const light = await storage.get('theme', 'light');
    const dark = await storage.get('theme', 'dark');

    expect(light?.active).toBe(false);
    expect(dark?.active).toBe(true);
    expect(dark?.priority).toBe(100);
  });

  it('falls back to another theme when deactivating the active theme', async () => {
    const storage = createStorage();

    await themeHandler.create!({ theme: 'light', name: 'Light', overrides: '{}' }, storage as never);
    await themeHandler.create!({ theme: 'editorial', name: 'Editorial', overrides: '{}' }, storage as never);
    await themeHandler.activate!({ theme: 'editorial', priority: 50 }, storage as never);
    const result = await themeHandler.deactivate!({ theme: 'editorial' }, storage as never);

    const light = await storage.get('theme', 'light');
    const editorial = await storage.get('theme', 'editorial');

    expect(result.variant).toBe('ok');
    expect(result.theme).toBe('light');
    expect(light?.active).toBe(true);
    expect(editorial?.active).toBe(false);
  });
});
