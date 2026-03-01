// SchemaEvolution — handler.ts
// Schema migration over time: track schema versions per subject, compute compatibility
// diffs between versions, transform data across schema versions, resolve reader/writer schemas.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';
import { createHash } from 'crypto';

import type {
  SchemaEvolutionStorage,
  SchemaEvolutionRegisterInput,
  SchemaEvolutionRegisterOutput,
  SchemaEvolutionCheckInput,
  SchemaEvolutionCheckOutput,
  SchemaEvolutionUpcastInput,
  SchemaEvolutionUpcastOutput,
  SchemaEvolutionResolveInput,
  SchemaEvolutionResolveOutput,
  SchemaEvolutionGetSchemaInput,
  SchemaEvolutionGetSchemaOutput,
} from './types.js';

import {
  registerOk,
  registerIncompatible,
  registerInvalidCompatibility,
  checkCompatible,
  checkIncompatible,
  upcastOk,
  upcastNoPath,
  upcastNotFound,
  resolveOk,
  resolveIncompatible,
  getSchemaOk,
  getSchemaNotFound,
} from './types.js';

export interface SchemaEvolutionError {
  readonly code: string;
  readonly message: string;
}

export interface SchemaEvolutionHandler {
  readonly register: (
    input: SchemaEvolutionRegisterInput,
    storage: SchemaEvolutionStorage,
  ) => TE.TaskEither<SchemaEvolutionError, SchemaEvolutionRegisterOutput>;
  readonly check: (
    input: SchemaEvolutionCheckInput,
    storage: SchemaEvolutionStorage,
  ) => TE.TaskEither<SchemaEvolutionError, SchemaEvolutionCheckOutput>;
  readonly upcast: (
    input: SchemaEvolutionUpcastInput,
    storage: SchemaEvolutionStorage,
  ) => TE.TaskEither<SchemaEvolutionError, SchemaEvolutionUpcastOutput>;
  readonly resolve: (
    input: SchemaEvolutionResolveInput,
    storage: SchemaEvolutionStorage,
  ) => TE.TaskEither<SchemaEvolutionError, SchemaEvolutionResolveOutput>;
  readonly getSchema: (
    input: SchemaEvolutionGetSchemaInput,
    storage: SchemaEvolutionStorage,
  ) => TE.TaskEither<SchemaEvolutionError, SchemaEvolutionGetSchemaOutput>;
}

const toError = (error: unknown): SchemaEvolutionError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const VALID_COMPATIBILITY_MODES = ['backward', 'forward', 'full', 'none'] as const;

const parseSchemaFields = (schema: Buffer): readonly string[] => {
  try {
    const parsed = JSON.parse(schema.toString('utf-8'));
    return Array.isArray(parsed.fields) ? parsed.fields : [];
  } catch {
    return [];
  }
};

const computeCompatibilityIssues = (
  oldFields: readonly string[],
  newFields: readonly string[],
  mode: string,
): readonly string[] => {
  const issues: string[] = [];
  const oldSet = new Set(oldFields);
  const newSet = new Set(newFields);

  const removed = oldFields.filter((f) => !newSet.has(f));
  const added = newFields.filter((f) => !oldSet.has(f));

  if (mode === 'backward' || mode === 'full') {
    removed.forEach((f) => issues.push(`Removed field '${f}' breaks backward compatibility`));
  }
  if (mode === 'forward' || mode === 'full') {
    added.forEach((f) => issues.push(`Added required field '${f}' breaks forward compatibility`));
  }
  return issues;
};

// --- Implementation ---

export const schemaEvolutionHandler: SchemaEvolutionHandler = {
  register: (input, storage) =>
    pipe(
      TE.right(input.compatibility),
      TE.chain((compat) => {
        if (!VALID_COMPATIBILITY_MODES.includes(compat as any)) {
          return TE.right(registerInvalidCompatibility(
            `Invalid compatibility mode '${compat}'. Must be one of: ${VALID_COMPATIBILITY_MODES.join(', ')}`,
          ));
        }
        return pipe(
          TE.tryCatch(
            () => storage.find('schema_versions', { subject: input.subject }),
            toError,
          ),
          TE.chain((existingVersions) => {
            const nextVersion = existingVersions.length + 1;
            const schemaId = createHash('sha256')
              .update(input.schema)
              .digest('hex')
              .slice(0, 16);

            if (existingVersions.length > 0 && input.compatibility !== 'none') {
              const latestRaw = existingVersions[existingVersions.length - 1];
              const latestSchemaBuf = Buffer.from((latestRaw as any).schema as string, 'utf-8');
              const oldFields = parseSchemaFields(latestSchemaBuf);
              const newFields = parseSchemaFields(input.schema);
              const issues = computeCompatibilityIssues(oldFields, newFields, input.compatibility);
              if (issues.length > 0) {
                return TE.right(registerIncompatible(issues));
              }
            }

            return TE.tryCatch(
              async () => {
                const versionKey = `${input.subject}::v${nextVersion}`;
                await storage.put('schema_versions', versionKey, {
                  subject: input.subject,
                  version: nextVersion,
                  schemaId,
                  schema: input.schema.toString('utf-8'),
                  compatibility: input.compatibility,
                  registeredAt: new Date().toISOString(),
                });
                return registerOk(nextVersion, schemaId);
              },
              toError,
            );
          }),
        );
      }),
    ),

  check: (input, storage) =>
    pipe(
      TE.right(undefined),
      TE.map(() => {
        const oldFields = parseSchemaFields(input.oldSchema);
        const newFields = parseSchemaFields(input.newSchema);
        const issues = computeCompatibilityIssues(oldFields, newFields, input.mode);
        return issues.length === 0 ? checkCompatible() : checkIncompatible(issues);
      }),
    ),

  upcast: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('schema_versions', { subject: input.subject }),
        toError,
      ),
      TE.chain((versions) => {
        if (versions.length === 0) {
          return TE.right(upcastNotFound(`Subject '${input.subject}' not found`));
        }

        const fromVer = versions.find((v) => (v as any).version === input.fromVersion);
        const toVer = versions.find((v) => (v as any).version === input.toVersion);

        if (!fromVer) {
          return TE.right(upcastNotFound(`Source version ${input.fromVersion} not found for '${input.subject}'`));
        }
        if (!toVer) {
          return TE.right(upcastNotFound(`Target version ${input.toVersion} not found for '${input.subject}'`));
        }

        if (input.fromVersion > input.toVersion) {
          return TE.right(upcastNoPath(
            `Cannot upcast from version ${input.fromVersion} to ${input.toVersion} (downcast not supported)`,
          ));
        }

        const targetFields = parseSchemaFields(Buffer.from((toVer as any).schema as string, 'utf-8'));
        const sourceData = JSON.parse(input.data.toString('utf-8'));
        const transformed: Record<string, unknown> = {};
        for (const field of targetFields) {
          transformed[field] = sourceData[field] ?? null;
        }
        return TE.right(upcastOk(Buffer.from(JSON.stringify(transformed), 'utf-8')));
      }),
    ),

  resolve: (input, storage) =>
    pipe(
      TE.right(undefined),
      TE.map(() => {
        const readerFields = parseSchemaFields(input.readerSchema);
        const writerFields = parseSchemaFields(input.writerSchema);
        const readerSet = new Set(readerFields);
        const writerSet = new Set(writerFields);

        const missingInWriter = readerFields.filter((f) => !writerSet.has(f));
        if (missingInWriter.length > 0) {
          return resolveIncompatible(
            missingInWriter.map((f) => `Reader expects field '${f}' not present in writer schema`),
          );
        }

        const resolvedFields = writerFields.filter((f) => readerSet.has(f));
        const resolved = { fields: resolvedFields };
        return resolveOk(Buffer.from(JSON.stringify(resolved), 'utf-8'));
      }),
    ),

  getSchema: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => {
          const versionKey = `${input.subject}::v${input.version}`;
          return storage.get('schema_versions', versionKey);
        },
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(getSchemaNotFound(
              `Schema version ${input.version} not found for subject '${input.subject}'`,
            )),
            (found) =>
              TE.right(getSchemaOk(
                Buffer.from((found as any).schema as string, 'utf-8'),
                (found as any).compatibility as string,
              )),
          ),
        ),
      ),
    ),
};
