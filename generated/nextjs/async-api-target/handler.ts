// AsyncApiTarget — Generates AsyncAPI specifications for event-driven concept interactions.
// Maps concept projections and sync specs to AsyncAPI channels, messages, and schemas.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import * as A from 'fp-ts/Array';
import { pipe } from 'fp-ts/function';

import type {
  AsyncApiTargetStorage,
  AsyncApiTargetGenerateInput,
  AsyncApiTargetGenerateOutput,
} from './types.js';

import {
  generateOk,
} from './types.js';

export interface AsyncApiTargetError {
  readonly code: string;
  readonly message: string;
}

export interface AsyncApiTargetHandler {
  readonly generate: (
    input: AsyncApiTargetGenerateInput,
    storage: AsyncApiTargetStorage,
  ) => TE.TaskEither<AsyncApiTargetError, AsyncApiTargetGenerateOutput>;
}

// --- Pure helpers ---

const storageError = (error: unknown): AsyncApiTargetError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Derive a channel name from a sync spec identifier (e.g., "user.sync" -> "user/events"). */
const deriveChannelName = (syncSpec: string): string => {
  const base = syncSpec.replace(/\.sync$/, '').replace(/\./g, '/');
  return `${base}/events`;
};

/** Derive a message name from a projection identifier. */
const deriveMessageName = (projection: string): string => {
  const parts = projection.split('.');
  const last = parts[parts.length - 1] ?? projection;
  return `${last}Message`;
};

/** Parse config JSON into an AsyncAPI metadata record. Falls back to defaults on parse failure. */
const parseConfig = (config: string): Record<string, unknown> =>
  pipe(
    O.tryCatch(() => JSON.parse(config) as Record<string, unknown>),
    O.getOrElse((): Record<string, unknown> => ({ title: 'Clef AsyncAPI', version: '1.0.0' })),
  );

/** Build the AsyncAPI YAML spec content from channels and messages. */
const buildSpecContent = (
  channels: readonly string[],
  messages: readonly string[],
  meta: Record<string, unknown>,
): string => {
  const title = (meta['title'] as string | undefined) ?? 'Clef AsyncAPI';
  const version = (meta['version'] as string | undefined) ?? '1.0.0';
  const channelBlock = channels
    .map((ch) => `  ${ch}:\n    subscribe:\n      message:\n        $ref: '#/components/messages/${ch.replace(/\//g, '_')}'`)
    .join('\n');
  const messageBlock = messages
    .map((msg) => `    ${msg}:\n      payload:\n        type: object`)
    .join('\n');
  return [
    `asyncapi: '2.6.0'`,
    `info:`,
    `  title: ${title}`,
    `  version: ${version}`,
    `channels:`,
    channelBlock,
    `components:`,
    `  messages:`,
    messageBlock,
  ].join('\n');
};

// --- Implementation ---

export const asyncApiTargetHandler: AsyncApiTargetHandler = {
  generate: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const meta = parseConfig(input.config);

          // Derive channels from sync specs
          const channels: readonly string[] = input.syncSpecs.map(deriveChannelName);

          // Derive messages from projections
          const messages: readonly string[] = input.projections.map(deriveMessageName);

          // Build the full AsyncAPI spec
          const specContent = buildSpecContent(channels, messages, meta);

          // Persist the generated spec
          const specKey = `asyncapi-${Date.now()}`;
          await storage.put('specs', specKey, {
            channels: [...channels],
            messages: [...messages],
            projections: [...input.projections],
            syncSpecs: [...input.syncSpecs],
            content: specContent,
          });

          return generateOk(specKey, specContent);
        },
        storageError,
      ),
    ),
};
