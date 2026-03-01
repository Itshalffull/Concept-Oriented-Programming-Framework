// TemporalVersion — Bitemporal versioning with valid-time and transaction-time
// dimensions: records content versions with temporal bounds, queries versions
// as-of a point in time, retrieves version ranges, identifies the current
// active version, and supersedes existing versions.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  TemporalVersionStorage,
  TemporalVersionRecordInput,
  TemporalVersionRecordOutput,
  TemporalVersionAsOfInput,
  TemporalVersionAsOfOutput,
  TemporalVersionBetweenInput,
  TemporalVersionBetweenOutput,
  TemporalVersionCurrentInput,
  TemporalVersionCurrentOutput,
  TemporalVersionSupersedeInput,
  TemporalVersionSupersedeOutput,
} from './types.js';

import {
  recordOk,
  recordInvalidHash,
  asOfOk,
  asOfNotFound,
  betweenOk,
  betweenInvalidDimension,
  currentOk,
  currentEmpty,
  supersedeOk,
  supersedeNotFound,
} from './types.js';

export interface TemporalVersionError {
  readonly code: string;
  readonly message: string;
}

const mkError = (code: string) => (error: unknown): TemporalVersionError => ({
  code,
  message: error instanceof Error ? error.message : String(error),
});

const VALID_DIMENSIONS: readonly string[] = ['valid', 'transaction', 'both'];

const isValidHash = (hash: string): boolean =>
  /^[a-f0-9]{8,128}$/.test(hash);

export interface TemporalVersionHandler {
  readonly record: (
    input: TemporalVersionRecordInput,
    storage: TemporalVersionStorage,
  ) => TE.TaskEither<TemporalVersionError, TemporalVersionRecordOutput>;
  readonly asOf: (
    input: TemporalVersionAsOfInput,
    storage: TemporalVersionStorage,
  ) => TE.TaskEither<TemporalVersionError, TemporalVersionAsOfOutput>;
  readonly between: (
    input: TemporalVersionBetweenInput,
    storage: TemporalVersionStorage,
  ) => TE.TaskEither<TemporalVersionError, TemporalVersionBetweenOutput>;
  readonly current: (
    input: TemporalVersionCurrentInput,
    storage: TemporalVersionStorage,
  ) => TE.TaskEither<TemporalVersionError, TemporalVersionCurrentOutput>;
  readonly supersede: (
    input: TemporalVersionSupersedeInput,
    storage: TemporalVersionStorage,
  ) => TE.TaskEither<TemporalVersionError, TemporalVersionSupersedeOutput>;
}

// --- Implementation ---

export const temporalVersionHandler: TemporalVersionHandler = {
  record: (input, storage) => {
    if (!isValidHash(input.contentHash)) {
      return TE.right(
        recordInvalidHash(
          `Content hash '${input.contentHash}' is not a valid hex hash`,
        ),
      );
    }
    const versionId = `ver-${input.contentHash.slice(0, 8)}-${Date.now()}`;
    const now = new Date().toISOString();
    const validFrom = pipe(
      input.validFrom,
      O.getOrElse(() => now),
    );
    const validTo = pipe(
      input.validTo,
      O.getOrElse(() => '9999-12-31T23:59:59.999Z'),
    );
    return pipe(
      TE.tryCatch(
        async () => {
          await storage.put('temporal_versions', versionId, {
            versionId,
            contentHash: input.contentHash,
            validFrom,
            validTo,
            transactionFrom: now,
            transactionTo: '9999-12-31T23:59:59.999Z',
            superseded: false,
            metadata: input.metadata.toString('base64'),
          });
          await storage.put('temporal_current', 'latest', {
            versionId,
            contentHash: input.contentHash,
            updatedAt: now,
          });
          return recordOk(versionId);
        },
        mkError('RECORD_FAILED'),
      ),
    );
  },

  asOf: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('temporal_versions'),
        mkError('STORAGE_READ'),
      ),
      TE.chain((allVersions) => {
        const systemTime = pipe(
          input.systemTime,
          O.getOrElse(() => new Date().toISOString()),
        );
        const validTime = pipe(
          input.validTime,
          O.getOrElse(() => new Date().toISOString()),
        );
        const matching = allVersions.filter((v) => {
          const txFrom = String(v.transactionFrom ?? '');
          const txTo = String(v.transactionTo ?? '9999-12-31T23:59:59.999Z');
          const vFrom = String(v.validFrom ?? '');
          const vTo = String(v.validTo ?? '9999-12-31T23:59:59.999Z');
          return (
            txFrom <= systemTime &&
            systemTime <= txTo &&
            vFrom <= validTime &&
            validTime <= vTo &&
            !v.superseded
          );
        });
        if (matching.length === 0) {
          return TE.right(
            asOfNotFound(
              `No version found at system-time ${systemTime}, valid-time ${validTime}`,
            ),
          );
        }
        const latest = matching[matching.length - 1];
        return TE.right(
          asOfOk(String(latest.versionId), String(latest.contentHash)),
        );
      }),
    ),

  between: (input, storage) => {
    if (!VALID_DIMENSIONS.includes(input.dimension)) {
      return TE.right(
        betweenInvalidDimension(
          `Dimension '${input.dimension}' is not valid. Use one of: ${VALID_DIMENSIONS.join(', ')}`,
        ),
      );
    }
    return pipe(
      TE.tryCatch(
        () => storage.find('temporal_versions'),
        mkError('STORAGE_READ'),
      ),
      TE.chain((allVersions) => {
        const filtered = allVersions.filter((v) => {
          if (input.dimension === 'valid') {
            const vFrom = String(v.validFrom ?? '');
            return vFrom >= input.start && vFrom <= input.end;
          }
          if (input.dimension === 'transaction') {
            const txFrom = String(v.transactionFrom ?? '');
            return txFrom >= input.start && txFrom <= input.end;
          }
          const vFrom = String(v.validFrom ?? '');
          const txFrom = String(v.transactionFrom ?? '');
          return (
            (vFrom >= input.start && vFrom <= input.end) ||
            (txFrom >= input.start && txFrom <= input.end)
          );
        });
        const versionIds = filtered.map((v) => String(v.versionId));
        return TE.right(betweenOk(versionIds));
      }),
    );
  },

  current: (_input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('temporal_current', 'latest'),
        mkError('STORAGE_READ'),
      ),
      TE.chain((latestRecord) =>
        pipe(
          O.fromNullable(latestRecord),
          O.fold(
            () =>
              TE.right(currentEmpty('No versions have been recorded yet')),
            (found) =>
              TE.right(
                currentOk(
                  String(found.versionId),
                  String(found.contentHash),
                ),
              ),
          ),
        ),
      ),
    ),

  supersede: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('temporal_versions', input.versionId),
        mkError('STORAGE_READ'),
      ),
      TE.chain((versionRecord) =>
        pipe(
          O.fromNullable(versionRecord),
          O.fold(
            () =>
              TE.right(
                supersedeNotFound(
                  `Version '${input.versionId}' not found`,
                ),
              ),
            (found) => {
              const now = new Date().toISOString();
              const newVersionId = `ver-${input.contentHash.slice(0, 8)}-${Date.now()}`;
              return pipe(
                TE.tryCatch(
                  async () => {
                    await storage.put('temporal_versions', input.versionId, {
                      ...found,
                      superseded: true,
                      transactionTo: now,
                    });
                    await storage.put('temporal_versions', newVersionId, {
                      versionId: newVersionId,
                      contentHash: input.contentHash,
                      validFrom: String(found.validFrom),
                      validTo: String(found.validTo),
                      transactionFrom: now,
                      transactionTo: '9999-12-31T23:59:59.999Z',
                      superseded: false,
                      supersedes: input.versionId,
                    });
                    await storage.put('temporal_current', 'latest', {
                      versionId: newVersionId,
                      contentHash: input.contentHash,
                      updatedAt: now,
                    });
                    return supersedeOk(newVersionId);
                  },
                  mkError('SUPERSEDE_FAILED'),
                ),
              );
            },
          ),
        ),
      ),
    ),
};
