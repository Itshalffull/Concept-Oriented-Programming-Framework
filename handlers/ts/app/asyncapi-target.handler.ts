// @migrated dsl-constructs 2026-03-18
// AsyncApiTarget Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, put, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

export const asyncapiTargetHandler: FunctionalConceptHandler = {
  generate(input: Record<string, unknown>) {
    const projections = input.projections as string[];
    const syncSpecs = input.syncSpecs as string[];
    const config = input.config as string;

    const parsedConfig = JSON.parse(config || '{}');
    const transport = (parsedConfig.transport as string) || 'websocket';

    const channelEntries: string[] = [];
    const operationEntries: string[] = [];

    for (const proj of projections) {
      channelEntries.push(`    ${proj}Channel:\n      address: /${proj}\n      messages:\n        ${proj}Message:\n          payload:\n            type: object`);
      operationEntries.push(`    ${proj}Publish:\n      action: send\n      channel:\n        $ref: '#/channels/${proj}Channel'`);
    }

    for (const sync of syncSpecs) {
      channelEntries.push(`    ${sync}SyncChannel:\n      address: /${sync}/sync\n      messages:\n        ${sync}SyncMessage:\n          payload:\n            type: object`);
      operationEntries.push(`    ${sync}Subscribe:\n      action: receive\n      channel:\n        $ref: '#/channels/${sync}SyncChannel'`);
    }

    const content = [
      'asyncapi: 3.0.0',
      'info:',
      `  title: Generated AsyncAPI Spec`,
      `  version: 1.0.0`,
      `  description: Generated from ${projections.length} projection(s) and ${syncSpecs.length} sync spec(s)`,
      'channels:',
      ...channelEntries,
      'operations:',
      ...operationEntries,
      `# Transport: ${transport}`,
      `# Protocol bindings: ${transport === 'kafka' ? 'kafka' : transport === 'amqp' ? 'amqp' : 'ws'}`,
    ].join('\n');

    const specId = `asyncapi-${Date.now()}`;

    let p = createProgram();
    p = put(p, 'spec', specId, {
      specId,
      version: '3.0.0',
      channels: projections.length + syncSpecs.length,
      operations: projections.length + syncSpecs.length,
      content,
      projections: JSON.stringify(projections),
      syncSpecs: JSON.stringify(syncSpecs),
      config,
      generatedAt: new Date().toISOString(),
    });

    return complete(p, 'ok', { spec: specId, content }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
