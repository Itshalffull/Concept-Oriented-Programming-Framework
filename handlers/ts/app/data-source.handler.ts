// DataSource Concept Implementation
import type { ConceptHandler } from '@clef/kernel';

export const dataSourceHandler: ConceptHandler = {
  async register(input, storage) {
    const name = input.name as string;
    const uri = input.uri as string;
    const credentials = input.credentials as string;

    const existing = await storage.find('dataSource');
    const duplicate = existing.find((s: any) => s.name === name);
    if (duplicate) {
      return { variant: 'exists', message: `Source "${name}" already registered` };
    }

    const sourceId = `src-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await storage.put('dataSource', sourceId, {
      sourceId,
      name,
      uri,
      credentials,
      discoveredSchema: null,
      status: 'active',
      lastHealthCheck: null,
      metadata: {},
    });

    return { variant: 'ok', sourceId };
  },

  async connect(input, storage) {
    const sourceId = input.sourceId as string;
    const source = await storage.get('dataSource', sourceId);
    if (!source) {
      return { variant: 'notfound', message: `Source "${sourceId}" not found` };
    }

    // Simulate connection test
    await storage.put('dataSource', sourceId, {
      ...source,
      status: 'active',
      lastHealthCheck: new Date().toISOString(),
    });

    return { variant: 'ok', message: 'connected' };
  },

  async discover(input, storage) {
    const sourceId = input.sourceId as string;
    const source = await storage.get('dataSource', sourceId);
    if (!source) {
      return { variant: 'notfound', message: `Source "${sourceId}" not found` };
    }

    await storage.put('dataSource', sourceId, {
      ...source,
      status: 'discovering',
    });

    // Discovery emits an event — actual protocol work happens via Connector sync
    const rawSchema = JSON.stringify({ streams: [], discoveredAt: new Date().toISOString() });

    await storage.put('dataSource', sourceId, {
      ...source,
      status: 'active',
      discoveredSchema: rawSchema,
    });

    return { variant: 'ok', rawSchema };
  },

  async healthCheck(input, storage) {
    const sourceId = input.sourceId as string;
    const source = await storage.get('dataSource', sourceId);
    if (!source) {
      return { variant: 'notfound', message: `Source "${sourceId}" not found` };
    }

    const now = new Date().toISOString();
    await storage.put('dataSource', sourceId, {
      ...source,
      lastHealthCheck: now,
    });

    return { variant: 'ok', status: source.status as string };
  },

  async deactivate(input, storage) {
    const sourceId = input.sourceId as string;
    const source = await storage.get('dataSource', sourceId);
    if (!source) {
      return { variant: 'notfound', message: `Source "${sourceId}" not found` };
    }

    await storage.put('dataSource', sourceId, {
      ...source,
      status: 'inactive',
    });

    return { variant: 'ok' };
  },
};
