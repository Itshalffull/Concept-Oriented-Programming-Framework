// TransportAdapterScaffoldGen — Transport adapter scaffold generator.
// Produces adapter stubs for a named transport protocol (e.g. http, ws,
// grpc, nats). Each adapter scaffold includes connection setup, message
// serialisation, and send/receive method stubs.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  TransportAdapterScaffoldGenStorage,
  TransportAdapterScaffoldGenGenerateInput,
  TransportAdapterScaffoldGenGenerateOutput,
  TransportAdapterScaffoldGenPreviewInput,
  TransportAdapterScaffoldGenPreviewOutput,
  TransportAdapterScaffoldGenRegisterInput,
  TransportAdapterScaffoldGenRegisterOutput,
} from './types.js';

import {
  generateOk,
  generateError,
  previewOk,
  previewCached,
  previewError,
  registerOk,
} from './types.js';

export interface TransportAdapterScaffoldGenError {
  readonly code: string;
  readonly message: string;
}

export interface TransportAdapterScaffoldGenHandler {
  readonly generate: (
    input: TransportAdapterScaffoldGenGenerateInput,
    storage: TransportAdapterScaffoldGenStorage,
  ) => TE.TaskEither<TransportAdapterScaffoldGenError, TransportAdapterScaffoldGenGenerateOutput>;
  readonly preview: (
    input: TransportAdapterScaffoldGenPreviewInput,
    storage: TransportAdapterScaffoldGenStorage,
  ) => TE.TaskEither<TransportAdapterScaffoldGenError, TransportAdapterScaffoldGenPreviewOutput>;
  readonly register: (
    input: TransportAdapterScaffoldGenRegisterInput,
    storage: TransportAdapterScaffoldGenStorage,
  ) => TE.TaskEither<TransportAdapterScaffoldGenError, TransportAdapterScaffoldGenRegisterOutput>;
}

// --- Pure helpers ---

const storageError = (error: unknown): TransportAdapterScaffoldGenError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Known transport protocols and their default ports. */
const PROTOCOL_DEFAULTS: Readonly<Record<string, { readonly port: number; readonly package: string }>> = {
  http: { port: 3000, package: 'node:http' },
  https: { port: 443, package: 'node:https' },
  ws: { port: 8080, package: 'ws' },
  wss: { port: 443, package: 'ws' },
  grpc: { port: 50051, package: '@grpc/grpc-js' },
  nats: { port: 4222, package: 'nats' },
  amqp: { port: 5672, package: 'amqplib' },
  mqtt: { port: 1883, package: 'mqtt' },
};

/** Convert name to PascalCase. */
const toPascalCase = (name: string): string =>
  name
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');

/** Build transport adapter scaffold files. */
const buildTransportFiles = (
  name: string,
  protocol: string,
): readonly Record<string, unknown>[] => {
  const pascal = toPascalCase(name);
  const defaults = PROTOCOL_DEFAULTS[protocol];
  const defaultPort = defaults?.port ?? 3000;
  const pkg = defaults?.package ?? protocol;

  return [
    {
      path: `transports/${name}/adapter.ts`,
      kind: 'adapter',
      content: [
        `// Transport adapter: ${pascal} (${protocol})`,
        `// Package: ${pkg}\n`,
        `export interface ${pascal}TransportConfig {`,
        `  readonly host: string;`,
        `  readonly port: number;`,
        `}\n`,
        `export const defaultConfig: ${pascal}TransportConfig = {`,
        `  host: 'localhost',`,
        `  port: ${defaultPort},`,
        `};\n`,
        `export const create${pascal}Transport = (config: ${pascal}TransportConfig = defaultConfig) => ({`,
        `  connect: async () => {`,
        `    // TODO: establish ${protocol} connection`,
        `  },`,
        `  send: async (message: unknown) => {`,
        `    // TODO: serialise and send via ${protocol}`,
        `  },`,
        `  receive: async (): Promise<unknown> => {`,
        `    // TODO: receive and deserialise from ${protocol}`,
        `    return null;`,
        `  },`,
        `  disconnect: async () => {`,
        `    // TODO: close ${protocol} connection`,
        `  },`,
        `});`,
      ].join('\n'),
    },
    {
      path: `transports/${name}/serialiser.ts`,
      kind: 'serialiser',
      content: [
        `// Message serialiser for ${pascal} transport`,
        `export const serialise = (message: unknown): Buffer =>`,
        `  Buffer.from(JSON.stringify(message));\n`,
        `export const deserialise = (data: Buffer): unknown =>`,
        `  JSON.parse(data.toString());`,
      ].join('\n'),
    },
    {
      path: `transports/${name}/index.ts`,
      kind: 'barrel',
      content: `export { create${pascal}Transport, defaultConfig } from './adapter.js';\nexport type { ${pascal}TransportConfig } from './adapter.js';`,
    },
  ];
};

// --- Implementation ---

export const transportAdapterScaffoldGenHandler: TransportAdapterScaffoldGenHandler = {
  generate: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const { name, protocol } = input;

          if (name.trim().length === 0) {
            return generateError('Transport name must be non-empty');
          }

          if (protocol.trim().length === 0) {
            return generateError('Protocol must be specified');
          }

          const files = buildTransportFiles(name, protocol);

          await storage.put('scaffolds', name, {
            name,
            protocol,
            files,
            generatedAt: new Date().toISOString(),
          });

          return generateOk(files, files.length);
        },
        storageError,
      ),
    ),

  preview: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const { name, protocol } = input;

          if (name.trim().length === 0) {
            return previewError('Transport name must be non-empty');
          }

          const existing = await storage.get('scaffolds', name);

          return pipe(
            O.fromNullable(existing),
            O.fold(
              () => {
                const files = buildTransportFiles(name, protocol);
                return previewOk(files, files.length, 0);
              },
              (cached) => {
                const cachedFiles = (cached['files'] as readonly unknown[]) ?? [];
                const newFiles = buildTransportFiles(name, protocol);

                const cachedPaths = new Set(
                  cachedFiles.map((f) => (f as Record<string, unknown>)['path'] as string),
                );
                const wouldWrite = newFiles.filter(
                  (f) => !cachedPaths.has(f['path'] as string),
                ).length;
                const wouldSkip = newFiles.length - wouldWrite;

                return wouldWrite === 0
                  ? previewCached()
                  : previewOk(newFiles, wouldWrite, wouldSkip);
              },
            ),
          );
        },
        storageError,
      ),
    ),

  register: (_input, _storage) =>
    pipe(
      TE.right(
        registerOk(
          'transport-adapter-scaffold-gen',
          'TransportAdapterScaffoldGenGenerateInput',
          'TransportAdapterScaffoldGenGenerateOutput',
          ['generate', 'preview', 'adapter', 'serialiser'],
        ),
      ),
    ),
};
