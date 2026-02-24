// Connector Concept Implementation
import type { ConceptHandler } from '@copf/kernel';

export const connectorHandler: ConceptHandler = {
  async configure(input, storage) {
    const sourceId = input.sourceId as string;
    const protocolId = input.protocolId as string;
    const config = input.config as string;

    let parsedConfig: Record<string, unknown>;
    try {
      parsedConfig = JSON.parse(config);
    } catch {
      return { variant: 'error', message: 'Invalid JSON configuration' };
    }

    const connectorId = `conn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await storage.put('connector', connectorId, {
      connectorId,
      sourceId,
      protocolId,
      config: parsedConfig,
      status: 'idle',
    });

    return { variant: 'ok', connectorId };
  },

  async read(input, storage) {
    const connectorId = input.connectorId as string;
    const query = input.query as string;

    const connector = await storage.get('connector', connectorId);
    if (!connector) {
      return { variant: 'notfound', message: `Connector "${connectorId}" not found` };
    }

    await storage.put('connector', connectorId, { ...connector, status: 'reading' });

    // Plugin-dispatched: actual read delegates to connector_protocol provider
    // Here we record the read request for the provider to handle
    const readId = `read-${Date.now()}`;
    await storage.put('connectorRead', readId, {
      connectorId,
      query,
      options: input.options || '{}',
      protocolId: connector.protocolId,
      config: connector.config,
      timestamp: new Date().toISOString(),
    });

    await storage.put('connector', connectorId, { ...connector, status: 'idle' });

    return { variant: 'ok', data: '[]' };
  },

  async write(input, storage) {
    const connectorId = input.connectorId as string;
    const data = input.data as string;

    const connector = await storage.get('connector', connectorId);
    if (!connector) {
      return { variant: 'notfound', message: `Connector "${connectorId}" not found` };
    }

    await storage.put('connector', connectorId, { ...connector, status: 'writing' });

    // Plugin-dispatched: actual write delegates to connector_protocol provider
    const writeId = `write-${Date.now()}`;
    await storage.put('connectorWrite', writeId, {
      connectorId,
      data,
      options: input.options || '{}',
      protocolId: connector.protocolId,
      config: connector.config,
      timestamp: new Date().toISOString(),
    });

    await storage.put('connector', connectorId, { ...connector, status: 'idle' });

    return { variant: 'ok', created: 0, updated: 0, skipped: 0, errors: 0 };
  },

  async test(input, storage) {
    const connectorId = input.connectorId as string;
    const connector = await storage.get('connector', connectorId);
    if (!connector) {
      return { variant: 'notfound', message: `Connector "${connectorId}" not found` };
    }

    // Plugin-dispatched: test delegates to connector_protocol provider
    return { variant: 'ok', message: 'connected' };
  },

  async discover(input, storage) {
    const connectorId = input.connectorId as string;
    const connector = await storage.get('connector', connectorId);
    if (!connector) {
      return { variant: 'notfound', message: `Connector "${connectorId}" not found` };
    }

    // Plugin-dispatched: discover delegates to connector_protocol provider
    return { variant: 'ok', streams: '[]' };
  },
};
