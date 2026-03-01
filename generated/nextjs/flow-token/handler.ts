// FlowToken — Flow control tokens tracking execution position within a process run.
// Tokens have three states: active (emitted), consumed (work done), killed (cancelled).

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  FlowTokenStorage,
  FlowTokenEmitInput,
  FlowTokenEmitOutput,
  FlowTokenConsumeInput,
  FlowTokenConsumeOutput,
  FlowTokenKillInput,
  FlowTokenKillOutput,
  FlowTokenCountActiveInput,
  FlowTokenCountActiveOutput,
  FlowTokenListActiveInput,
  FlowTokenListActiveOutput,
} from './types.js';

import {
  emitOk,
  consumeOk,
  consumeNotFound,
  consumeAlreadyConsumed,
  killOk,
  killNotFound,
  countActiveOk,
  listActiveOk,
} from './types.js';

export interface FlowTokenError {
  readonly code: string;
  readonly message: string;
}

export interface FlowTokenHandler {
  readonly emit: (input: FlowTokenEmitInput, storage: FlowTokenStorage) => TE.TaskEither<FlowTokenError, FlowTokenEmitOutput>;
  readonly consume: (input: FlowTokenConsumeInput, storage: FlowTokenStorage) => TE.TaskEither<FlowTokenError, FlowTokenConsumeOutput>;
  readonly kill: (input: FlowTokenKillInput, storage: FlowTokenStorage) => TE.TaskEither<FlowTokenError, FlowTokenKillOutput>;
  readonly countActive: (input: FlowTokenCountActiveInput, storage: FlowTokenStorage) => TE.TaskEither<FlowTokenError, FlowTokenCountActiveOutput>;
  readonly listActive: (input: FlowTokenListActiveInput, storage: FlowTokenStorage) => TE.TaskEither<FlowTokenError, FlowTokenListActiveOutput>;
}

const storageError = (error: unknown): FlowTokenError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const generateTokenId = (): string => {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `ft_${timestamp}_${randomPart}`;
};

export const flowTokenHandler: FlowTokenHandler = {
  emit: (input, storage) =>
    pipe(
      TE.tryCatch(async () => {
        const tokenId = generateTokenId();
        const now = new Date().toISOString();

        await storage.put('flow_tokens', tokenId, {
          token_id: tokenId,
          run_ref: input.run_ref,
          position: input.position,
          payload: input.payload,
          status: 'active',
          emitted_at: now,
        });

        return emitOk(tokenId, input.position);
      }, storageError),
    ),

  consume: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('flow_tokens', input.token_id),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(consumeNotFound(input.token_id) as FlowTokenConsumeOutput),
            (token) => {
              if (token.status !== 'active') {
                return TE.right(consumeAlreadyConsumed(input.token_id) as FlowTokenConsumeOutput);
              }
              return TE.tryCatch(async () => {
                await storage.put('flow_tokens', input.token_id, {
                  ...token,
                  status: 'consumed',
                  consumed_at: new Date().toISOString(),
                });
                return consumeOk(input.token_id) as FlowTokenConsumeOutput;
              }, storageError);
            },
          ),
        ),
      ),
    ),

  kill: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('flow_tokens', input.token_id),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(killNotFound(input.token_id) as FlowTokenKillOutput),
            (token) =>
              TE.tryCatch(async () => {
                await storage.put('flow_tokens', input.token_id, {
                  ...token,
                  status: 'killed',
                  killed_at: new Date().toISOString(),
                  kill_reason: input.reason,
                });
                return killOk(input.token_id) as FlowTokenKillOutput;
              }, storageError),
          ),
        ),
      ),
    ),

  countActive: (input, storage) =>
    pipe(
      TE.tryCatch(async () => {
        const all = await storage.find('flow_tokens', { run_ref: input.run_ref });
        const activeCount = all.filter((t) => t.status === 'active').length;
        return countActiveOk(activeCount);
      }, storageError),
    ),

  listActive: (input, storage) =>
    pipe(
      TE.tryCatch(async () => {
        const all = await storage.find('flow_tokens', { run_ref: input.run_ref });
        const active = all.filter((t) => t.status === 'active');
        const summaries = active.map((t) => ({
          token_id: t.token_id,
          position: t.position,
          emitted_at: t.emitted_at,
        }));
        return listActiveOk(JSON.stringify(summaries), summaries.length);
      }, storageError),
    ),
};
