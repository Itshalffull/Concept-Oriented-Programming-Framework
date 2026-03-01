// Provenance — Data lineage tracking: record entity origins with activity/agent metadata,
// trace lineage chains, audit batches, rollback transformations, diff versions,
// and produce reproducibility plans.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ProvenanceStorage,
  ProvenanceRecordInput,
  ProvenanceRecordOutput,
  ProvenanceTraceInput,
  ProvenanceTraceOutput,
  ProvenanceAuditInput,
  ProvenanceAuditOutput,
  ProvenanceRollbackInput,
  ProvenanceRollbackOutput,
  ProvenanceDiffInput,
  ProvenanceDiffOutput,
  ProvenanceReproduceInput,
  ProvenanceReproduceOutput,
} from './types.js';

import {
  recordOk,
  traceOk,
  traceNotfound,
  auditOk,
  auditNotfound,
  rollbackOk,
  rollbackNotfound,
  diffOk,
  diffNotfound,
  reproduceOk,
  reproduceNotfound,
} from './types.js';

export interface ProvenanceError {
  readonly code: string;
  readonly message: string;
}

const toProvenanceError = (error: unknown): ProvenanceError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

export interface ProvenanceHandler {
  readonly record: (
    input: ProvenanceRecordInput,
    storage: ProvenanceStorage,
  ) => TE.TaskEither<ProvenanceError, ProvenanceRecordOutput>;
  readonly trace: (
    input: ProvenanceTraceInput,
    storage: ProvenanceStorage,
  ) => TE.TaskEither<ProvenanceError, ProvenanceTraceOutput>;
  readonly audit: (
    input: ProvenanceAuditInput,
    storage: ProvenanceStorage,
  ) => TE.TaskEither<ProvenanceError, ProvenanceAuditOutput>;
  readonly rollback: (
    input: ProvenanceRollbackInput,
    storage: ProvenanceStorage,
  ) => TE.TaskEither<ProvenanceError, ProvenanceRollbackOutput>;
  readonly diff: (
    input: ProvenanceDiffInput,
    storage: ProvenanceStorage,
  ) => TE.TaskEither<ProvenanceError, ProvenanceDiffOutput>;
  readonly reproduce: (
    input: ProvenanceReproduceInput,
    storage: ProvenanceStorage,
  ) => TE.TaskEither<ProvenanceError, ProvenanceReproduceOutput>;
}

// --- Implementation ---

export const provenanceHandler: ProvenanceHandler = {
  // Record a provenance entry: which entity was produced by which activity and agent.
  record: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const recordId = `prov:${input.entity}:${Date.now()}`;
          await storage.put('provenance', recordId, {
            recordId,
            entity: input.entity,
            activity: input.activity,
            agent: input.agent,
            inputs: input.inputs,
            timestamp: new Date().toISOString(),
          });
          // Maintain a chain of provenance records per entity
          const chainRecord = await storage.get('provenance_chain', input.entity);
          const chain = chainRecord && Array.isArray((chainRecord as Record<string, unknown>).ids)
            ? [...((chainRecord as Record<string, unknown>).ids as readonly string[])]
            : [];
          chain.push(recordId);
          await storage.put('provenance_chain', input.entity, {
            entity: input.entity,
            ids: chain,
          });
          return recordOk(recordId);
        },
        toProvenanceError,
      ),
    ),

  // Trace the full lineage chain for an entity back to its origin.
  trace: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('provenance_chain', input.entityId),
        toProvenanceError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right<ProvenanceError, ProvenanceTraceOutput>(
                traceNotfound(`No provenance records for entity '${input.entityId}'`),
              ),
            (found) => {
              const ids = (found as Record<string, unknown>).ids;
              const chain = Array.isArray(ids) ? (ids as readonly string[]).join(' -> ') : '';
              return TE.right<ProvenanceError, ProvenanceTraceOutput>(traceOk(chain));
            },
          ),
        ),
      ),
    ),

  // Audit all provenance records associated with a batch ID.
  audit: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const records = await storage.find('provenance', { batchId: input.batchId });
          if (records.length === 0) {
            // Also check if the batchId is a known entity
            const chainRecord = await storage.get('provenance_chain', input.batchId);
            if (!chainRecord) {
              return auditNotfound(`No provenance records for batch '${input.batchId}'`);
            }
            const ids = (chainRecord as Record<string, unknown>).ids;
            const graph = Array.isArray(ids) ? (ids as readonly string[]).join(',') : '';
            return auditOk(graph);
          }
          const graph = records
            .map((r) => String((r as Record<string, unknown>).recordId ?? ''))
            .join(',');
          return auditOk(graph);
        },
        toProvenanceError,
      ),
    ),

  // Rollback all provenance records in a batch by removing them.
  rollback: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('provenance_chain', input.batchId),
        toProvenanceError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right<ProvenanceError, ProvenanceRollbackOutput>(
                rollbackNotfound(`No provenance records for batch '${input.batchId}'`),
              ),
            (found) =>
              TE.tryCatch(
                async () => {
                  const ids = (found as Record<string, unknown>).ids;
                  const chain = Array.isArray(ids) ? (ids as readonly string[]) : [];
                  for (const id of chain) {
                    await storage.delete('provenance', id);
                  }
                  await storage.delete('provenance_chain', input.batchId);
                  return rollbackOk(chain.length);
                },
                toProvenanceError,
              ),
          ),
        ),
      ),
    ),

  // Diff two versions of an entity's provenance to show what changed.
  diff: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('provenance_chain', input.entityId),
        toProvenanceError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right<ProvenanceError, ProvenanceDiffOutput>(
                diffNotfound(`No provenance for entity '${input.entityId}'`),
              ),
            () =>
              TE.tryCatch(
                async () => {
                  const v1 = await storage.get('provenance', input.version1);
                  const v2 = await storage.get('provenance', input.version2);
                  const v1Data = v1 ? JSON.stringify(v1) : '{}';
                  const v2Data = v2 ? JSON.stringify(v2) : '{}';
                  const changes = v1Data === v2Data
                    ? 'no changes'
                    : `${input.version1} -> ${input.version2}: fields differ`;
                  return diffOk(changes);
                },
                toProvenanceError,
              ),
          ),
        ),
      ),
    ),

  // Produce a reproducibility plan: the full sequence of activities needed to recreate an entity.
  reproduce: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('provenance_chain', input.entityId),
        toProvenanceError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right<ProvenanceError, ProvenanceReproduceOutput>(
                reproduceNotfound(`No provenance for entity '${input.entityId}'`),
              ),
            (found) =>
              TE.tryCatch(
                async () => {
                  const ids = (found as Record<string, unknown>).ids;
                  const chain = Array.isArray(ids) ? (ids as readonly string[]) : [];
                  const steps: string[] = [];
                  for (const id of chain) {
                    const prov = await storage.get('provenance', id);
                    if (prov) {
                      const r = prov as Record<string, unknown>;
                      steps.push(`${r.activity}(${r.inputs}) by ${r.agent}`);
                    }
                  }
                  return reproduceOk(steps.join(' ; '));
                },
                toProvenanceError,
              ),
          ),
        ),
      ),
    ),
};
