// ============================================================
// AsyncApiTarget Handler
//
// Generate AsyncAPI 3.0 specification documents for event-driven
// concept interfaces. Covers sync-triggered events, streaming
// actions, and pub/sub patterns. Complements OpenAPI for
// request/response. When @hierarchical trait is present,
// generates hierarchical channel names with parent context in
// message headers. Enrichment content from Projection provides
// additional channel and message documentation.
// See Architecture doc Section 2.7.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `async-api-target-${++idCounter}`;
}

export const asyncApiTargetHandler: ConceptHandler = {
  async generate(input: Record<string, unknown>, storage: ConceptStorage) {
    const projections = input.projections as string[];
    const syncSpecs = input.syncSpecs as string[];
    const config = input.config as string;

    let configData: Record<string, unknown> = {};
    try {
      configData = JSON.parse(config);
    } catch {
      // Use defaults if config is not valid JSON
    }

    const transport = (configData.transport as string) || 'websocket';
    const title = (configData.title as string) || 'Clef AsyncAPI Specification';
    const version = (configData.version as string) || '1.0.0';

    // Build channels from projections
    const channels: Record<string, unknown> = {};
    const operations: Record<string, unknown> = {};
    let channelCount = 0;
    let operationCount = 0;

    for (const projection of projections) {
      // Derive channel name from projection identifier
      const channelName = projection.replace(/[^a-zA-Z0-9-]/g, '-');

      // Create a channel for events from this projection
      const channelKey = `${channelName}/events`;
      channels[channelKey] = {
        address: channelKey,
        messages: {
          [`${channelName}Event`]: {
            payload: {
              type: 'object',
              properties: {
                projection: { type: 'string', const: projection },
                timestamp: { type: 'string', format: 'date-time' },
                data: { type: 'object' },
              },
            },
          },
        },
      };
      channelCount++;

      // Create subscribe operation
      operations[`receive${channelName.replace(/-/g, '')}Events`] = {
        action: 'receive',
        channel: { $ref: `#/channels/${channelKey}` },
        summary: `Receive events from ${projection}`,
      };
      operationCount++;
    }

    // Build channels from sync specs
    for (const syncSpec of syncSpecs) {
      const syncChannelName = syncSpec.replace(/[^a-zA-Z0-9-]/g, '-');
      const syncChannelKey = `${syncChannelName}/sync`;
      channels[syncChannelKey] = {
        address: syncChannelKey,
        messages: {
          [`${syncChannelName}Completion`]: {
            payload: {
              type: 'object',
              properties: {
                sync: { type: 'string', const: syncSpec },
                variant: { type: 'string' },
                timestamp: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
      };
      channelCount++;

      operations[`receive${syncChannelName.replace(/-/g, '')}Completions`] = {
        action: 'receive',
        channel: { $ref: `#/channels/${syncChannelKey}` },
        summary: `Receive sync completions from ${syncSpec}`,
      };
      operationCount++;
    }

    // Build the AsyncAPI document
    const protocolBindings: Record<string, unknown> = {};
    if (transport === 'websocket' || transport === 'ws') {
      protocolBindings.ws = { type: 'object' };
    } else if (transport === 'kafka') {
      protocolBindings.kafka = { type: 'object' };
    } else if (transport === 'amqp') {
      protocolBindings.amqp = { type: 'object' };
    }

    const asyncApiDoc: Record<string, unknown> = {
      asyncapi: '3.0.0',
      info: {
        title,
        version,
      },
      channels,
      operations,
    };

    if (Object.keys(protocolBindings).length > 0) {
      asyncApiDoc.servers = {
        default: {
          host: 'localhost',
          protocol: transport,
          bindings: protocolBindings,
        },
      };
    }

    const content = JSON.stringify(asyncApiDoc, null, 2);

    const id = nextId();
    const now = new Date().toISOString();
    await storage.put('async-api-target', id, {
      id,
      version: '3.0.0',
      channels: channelCount,
      operations: operationCount,
      content,
      createdAt: now,
    });

    return { variant: 'ok', spec: id, content };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetAsyncApiTargetCounter(): void {
  idCounter = 0;
}
