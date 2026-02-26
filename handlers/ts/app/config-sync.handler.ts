// ConfigSync Concept Implementation
import type { ConceptHandler } from '@clef/runtime';

export const configSyncHandler: ConceptHandler = {
  async export(input, storage) {
    const config = input.config as string;

    const entry = await storage.get('config', config);
    if (!entry) {
      return { variant: 'notfound' };
    }

    const data = entry.data as Record<string, unknown>;
    const overrides = (entry.overrides ?? {}) as Record<string, Record<string, unknown>>;

    // Merge base data with all override layers
    const merged = { ...data };
    for (const layer of Object.keys(overrides)) {
      const layerValues = overrides[layer];
      for (const [k, v] of Object.entries(layerValues)) {
        (merged as Record<string, unknown>)[k] = v;
      }
    }

    return { variant: 'ok', data: JSON.stringify(merged) };
  },

  async import(input, storage) {
    const config = input.config as string;
    const rawData = input.data as string;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawData) as Record<string, unknown>;
    } catch {
      return { variant: 'error', message: 'Invalid JSON data' };
    }

    const existing = await storage.get('config', config);
    const overrides = existing
      ? (existing.overrides ?? {}) as Record<string, Record<string, unknown>>
      : {};

    await storage.put('config', config, {
      config,
      data: parsed,
      overrides,
    });

    return { variant: 'ok' };
  },

  async override(input, storage) {
    const config = input.config as string;
    const layer = input.layer as string;
    const values = input.values as string;

    const entry = await storage.get('config', config);
    if (!entry) {
      return { variant: 'notfound' };
    }

    const overrides = (entry.overrides ?? {}) as Record<string, Record<string, unknown>>;

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
      overrides,
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

    const dataA = entryA.data as Record<string, unknown>;
    const dataB = entryB.data as Record<string, unknown>;

    const allKeys = new Set([...Object.keys(dataA), ...Object.keys(dataB)]);
    const changes: Array<{ key: string; a: unknown; b: unknown }> = [];

    for (const key of allKeys) {
      const valA = dataA[key];
      const valB = dataB[key];
      if (JSON.stringify(valA) !== JSON.stringify(valB)) {
        changes.push({ key, a: valA ?? null, b: valB ?? null });
      }
    }

    return { variant: 'ok', changes: JSON.stringify(changes) };
  },
};
