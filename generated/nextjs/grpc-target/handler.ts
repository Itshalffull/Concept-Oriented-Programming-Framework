// GrpcTarget — Generates gRPC protobuf service and message definitions from concept projections.
// Detects proto3 incompatibilities and field number conflicts across message definitions.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  GrpcTargetStorage,
  GrpcTargetGenerateInput,
  GrpcTargetGenerateOutput,
  GrpcTargetValidateInput,
  GrpcTargetValidateOutput,
  GrpcTargetListRpcsInput,
  GrpcTargetListRpcsOutput,
} from './types.js';

import {
  generateOk,
  generateProtoIncompatible,
  validateOk,
  validateFieldNumberConflict,
  listRpcsOk,
} from './types.js';

export interface GrpcTargetError {
  readonly code: string;
  readonly message: string;
}

export interface GrpcTargetHandler {
  readonly generate: (
    input: GrpcTargetGenerateInput,
    storage: GrpcTargetStorage,
  ) => TE.TaskEither<GrpcTargetError, GrpcTargetGenerateOutput>;
  readonly validate: (
    input: GrpcTargetValidateInput,
    storage: GrpcTargetStorage,
  ) => TE.TaskEither<GrpcTargetError, GrpcTargetValidateOutput>;
  readonly listRpcs: (
    input: GrpcTargetListRpcsInput,
    storage: GrpcTargetStorage,
  ) => TE.TaskEither<GrpcTargetError, GrpcTargetListRpcsOutput>;
}

// --- Pure helpers ---

const storageError = (error: unknown): GrpcTargetError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Proto3 reserved field numbers that cannot be used. */
const PROTO3_RESERVED_RANGE_START = 19000;
const PROTO3_RESERVED_RANGE_END = 19999;

/** Types that cannot be represented natively in proto3. */
const PROTO_INCOMPATIBLE_TYPES: readonly string[] = [
  'any', 'unknown', 'undefined', 'symbol', 'bigint', 'function',
];

/** Parse a projection into concept metadata with fields and actions. */
const parseProjection = (projection: string): {
  readonly concept: string;
  readonly fields: readonly { readonly name: string; readonly type: string; readonly number: number }[];
  readonly actions: readonly string[];
} =>
  pipe(
    O.tryCatch(() => JSON.parse(projection) as Record<string, unknown>),
    O.map((parsed) => ({
      concept: (parsed['concept'] as string | undefined) ?? 'Unknown',
      fields: (parsed['fields'] as readonly { name: string; type: string; number: number }[] | undefined) ?? [],
      actions: (parsed['actions'] as readonly string[] | undefined) ?? ['create', 'get', 'list', 'update', 'delete'],
    })),
    O.getOrElse(() => ({
      concept: projection,
      fields: [] as readonly { readonly name: string; readonly type: string; readonly number: number }[],
      actions: ['create', 'get', 'list', 'update', 'delete'] as readonly string[],
    })),
  );

/** Convert a concept name to a PascalCase proto service name. */
const toServiceName = (concept: string): string =>
  concept.replace(/(^|[-_])(\w)/g, (_, __, c: string) => c.toUpperCase()) + 'Service';

/** Convert an action name to an RPC method name. */
const toRpcName = (action: string): string =>
  action.charAt(0).toUpperCase() + action.slice(1);

/** Determine the streaming mode for an RPC based on its action verb. */
const inferStreamingMode = (action: string): string => {
  const verb = action.toLowerCase();
  if (['list', 'watch', 'stream', 'subscribe'].includes(verb)) return 'server-streaming';
  if (['upload', 'batch', 'bulk'].includes(verb)) return 'client-streaming';
  if (['sync', 'chat', 'bidirectional'].includes(verb)) return 'bidi-streaming';
  return 'unary';
};

/** Check if a field type is incompatible with proto3. */
const isIncompatibleType = (fieldType: string): boolean =>
  PROTO_INCOMPATIBLE_TYPES.includes(fieldType.toLowerCase());

/** Check if a field number falls in the proto3 reserved range. */
const isReservedFieldNumber = (num: number): boolean =>
  num >= PROTO3_RESERVED_RANGE_START && num <= PROTO3_RESERVED_RANGE_END;

// --- Implementation ---

export const grpcTargetHandler: GrpcTargetHandler = {
  generate: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const { concept, fields, actions } = parseProjection(input.projection);
          const serviceName = toServiceName(concept);

          // Check for proto-incompatible field types
          for (const field of fields) {
            if (isIncompatibleType(field.type)) {
              return generateProtoIncompatible(
                field.type,
                `Type '${field.type}' in field '${field.name}' has no proto3 representation`,
              );
            }
          }

          // Generate RPC definitions and determine streaming modes
          const rpcs: string[] = [];
          const streamingModes: string[] = [];
          const services: string[] = [serviceName];
          const files: string[] = [];

          for (const action of actions) {
            const rpcName = toRpcName(action);
            const mode = inferStreamingMode(action);
            rpcs.push(rpcName);
            streamingModes.push(mode);
          }

          // Persist the service definition
          await storage.put('services', serviceName, {
            concept,
            serviceName,
            rpcs: [...rpcs],
            streamingModes: [...streamingModes],
            fields: fields.map((f) => ({ ...f })),
          });

          const fileName = `${concept}.proto`;
          files.push(fileName);
          await storage.put('files', fileName, { concept, serviceName, fileName });

          return generateOk(services, files);
        },
        storageError,
      ),
    ),

  validate: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const serviceRecord = await storage.get('services', input.service);

          return pipe(
            O.fromNullable(serviceRecord),
            O.fold(
              () => validateOk(input.service),
              (record) => {
                const fields = (record['fields'] as readonly { name: string; type: string; number: number }[] | undefined) ?? [];
                // Check for field number conflicts: duplicates or reserved range usage
                const fieldNumberMap = new Map<number, string>();
                for (const field of fields) {
                  if (isReservedFieldNumber(field.number)) {
                    return validateFieldNumberConflict(
                      input.service,
                      `${input.service}Request`,
                      field.name,
                    );
                  }
                  const existing = fieldNumberMap.get(field.number);
                  if (existing !== undefined) {
                    return validateFieldNumberConflict(
                      input.service,
                      `Duplicate field number ${field.number}: '${existing}' and '${field.name}'`,
                      field.name,
                    );
                  }
                  fieldNumberMap.set(field.number, field.name);
                }
                return validateOk(input.service);
              },
            ),
          );
        },
        storageError,
      ),
    ),

  listRpcs: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const allServices = await storage.find('services', { concept: input.concept });
          const rpcs: string[] = [];
          const streamingModes: string[] = [];

          for (const record of allServices) {
            rpcs.push(...((record['rpcs'] as readonly string[] | undefined) ?? []));
            streamingModes.push(...((record['streamingModes'] as readonly string[] | undefined) ?? []));
          }

          return listRpcsOk(rpcs, streamingModes);
        },
        storageError,
      ),
    ),
};
