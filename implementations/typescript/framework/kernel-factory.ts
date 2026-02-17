// ============================================================
// Convenience Kernel Factory
//
// Wires together the kernel's createSelfHostedKernel with the
// SyncEngine concept handler. Provides high-level methods like
// loadSyncs, parseConcept, getFlowTrace, etc.
//
// This is NOT kernel code — it depends on concept implementations
// and belongs in the application/framework layer.
// ============================================================

import { readFileSync } from 'fs';
import { createConceptRegistry, createInProcessAdapter } from '../../../kernel/src/transport.js';
import { createInMemoryStorage } from '../../../kernel/src/storage.js';
import { createSelfHostedKernel } from '../../../kernel/src/self-hosted.js';
import type { Kernel } from '../../../kernel/src/self-hosted.js';
import type { ConceptHandler } from '../../../kernel/src/types.js';
import { createSyncEngineHandler } from './sync-engine.impl.js';
import { parseConceptFile } from './spec-parser.impl.js';
import { parseSyncFile } from './sync-parser.impl.js';
import { buildFlowTrace } from './flow-trace.impl.js';
import type { FlowTrace } from './flow-trace.impl.js';
import {
  checkMigrationNeeded,
  createMigrationGatedTransport,
} from './migration.impl.js';

export interface MigrationStatus {
  uri: string;
  currentVersion: number;
  requiredVersion: number;
  migrationRequired: boolean;
}

export interface FullKernel extends Kernel {
  loadSyncs(path: string): Promise<void>;
  parseConcept(path: string): ReturnType<typeof parseConceptFile>;
  getFlowTrace(flowId: string): FlowTrace | null;
  registerVersionedConcept(
    uri: string,
    handler: ConceptHandler,
    specVersion?: number,
  ): Promise<MigrationStatus | null>;
  getMigrationStatus(): MigrationStatus[];
}

export function createKernel(): FullKernel {
  const registry = createConceptRegistry();
  const { handler, engine, log } = createSyncEngineHandler(registry);
  const base = createSelfHostedKernel(handler, log, registry);

  const migrationStatuses = new Map<string, MigrationStatus>();

  return {
    ...base,

    async loadSyncs(path: string): Promise<void> {
      const source = readFileSync(path, 'utf-8');
      const syncs = parseSyncFile(source);
      for (const sync of syncs) {
        base.registerSync(sync);
      }
    },

    parseConcept(path: string) {
      const source = readFileSync(path, 'utf-8');
      return parseConceptFile(source);
    },

    getFlowTrace(flowId: string): FlowTrace | null {
      return buildFlowTrace(
        flowId,
        log,
        engine.getSyncIndex(),
        engine.getRegisteredSyncs(),
      );
    },

    async registerVersionedConcept(
      uri: string,
      conceptHandler: ConceptHandler,
      specVersion?: number,
    ): Promise<MigrationStatus | null> {
      const storage = createInMemoryStorage();
      const baseTransport = createInProcessAdapter(conceptHandler, storage);

      const needed = await checkMigrationNeeded(specVersion, storage);

      if (needed) {
        const gated = createMigrationGatedTransport(
          baseTransport,
          storage,
          needed.currentVersion,
          needed.requiredVersion,
        );
        registry.register(uri, gated);

        const status: MigrationStatus = {
          uri,
          currentVersion: needed.currentVersion,
          requiredVersion: needed.requiredVersion,
          migrationRequired: true,
        };
        migrationStatuses.set(uri, status);
        return status;
      }

      registry.register(uri, baseTransport);
      if (specVersion !== undefined) {
        migrationStatuses.set(uri, {
          uri,
          currentVersion: specVersion,
          requiredVersion: specVersion,
          migrationRequired: false,
        });
      }
      return null;
    },

    getMigrationStatus(): MigrationStatus[] {
      return [...migrationStatuses.values()];
    },
  };
}
