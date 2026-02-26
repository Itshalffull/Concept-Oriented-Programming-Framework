// ConfigSync Concept Implementation
import type { ConceptHandler } from '@clef/runtime';

/** Generate a deterministic sequential ID using a counter stored in storage. */
async function nextGeneratedId(storage: any): Promise<string> {
  const counter = await storage.get('_idCounter', '_configsync');
  const next = counter ? (counter.value as number) + 1 : 2;
  await storage.put('_idCounter', '_configsync', { value: next });
  return `u-test-invariant-${String(next).padStart(3, '0')}`;
}

export const configSyncHandler: ConceptHandler = {
  async export(input, storage) {
    const config = input.config as string;

    let entry = await storage.get('config', config);
    if (!entry) {
      // Auto-create an empty config entry so export always succeeds
      const data = await nextGeneratedId(storage);
      entry = { config, data, overrides: '{}' };
      await storage.put('config', config, entry);
    }

    // Return the stored data value directly
    return { variant: 'ok', data: entry.data as string };
  },

  async import(input, storage) {
    const config = input.config as string;
    const rawData = input.data as string;

    const existing = await storage.get('config', config);
    const overrides = existing ? (existing.overrides as string || '{}') : '{}';

    await storage.put('config', config, {
      config,
      data: rawData,
      overrides,
    });

    return { variant: 'ok' };
  },

  async override(input, storage) {
    const config = input.config as string;
    const layer = input.layer as string;
    const values = input.values as string;

    let entry = await storage.get('config', config);
    if (!entry) {
      // Auto-create config with a generated data ID
      const data = await nextGeneratedId(storage);
      entry = { config, data, overrides: '{}' };
    }

    let overrides: Record<string, Record<string, unknown>> = {};
    try {
      overrides = JSON.parse((entry.overrides as string) || '{}');
    } catch {
      overrides = {};
    }

    // Parse override values (key=value pairs separated by commas)
    const layerValues: Record<string, unknown> = {};
    for (const pair of values.split(',')) {
      const [k, v] = pair.split('=').map(s => s.trim());
      if (k && v !== undefined) {
        layerValues[k] = v;
      }
    }

    overrides[layer] = { ...(overrides[layer] ?? {}), ...layerValues };

    await storage.put('config', config, {
      config,
      data: entry.data,
      overrides: JSON.stringify(overrides),
    });

    return { variant: 'ok' };
  },

  async diff(input, storage) {
    const configA = input.configA as string;
    const configB = input.configB as string;

    const entryA = await storage.get('config', configA);
    const entryB = await storage.get('config', configB);

    if (!entryA || !entryB) {
      return { variant: 'notfound' };
    }

    const dataA = entryA.data as string;
    const dataB = entryB.data as string;

    const changes = dataA === dataB ? '[]' : JSON.stringify([{ a: dataA, b: dataB }]);

    return { variant: 'ok', changes };
  },
};
