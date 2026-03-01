// ToolRegistry — Manages LLM tool definitions with versioning, access control, and lifecycle.
// Tools transition through active, deprecated, and disabled states.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ToolRegistryStorage,
  ToolRegistryRegisterInput,
  ToolRegistryRegisterOutput,
  ToolRegistryDeprecateInput,
  ToolRegistryDeprecateOutput,
  ToolRegistryDisableInput,
  ToolRegistryDisableOutput,
  ToolRegistryAuthorizeInput,
  ToolRegistryAuthorizeOutput,
  ToolRegistryCheckAccessInput,
  ToolRegistryCheckAccessOutput,
  ToolRegistryListActiveInput,
  ToolRegistryListActiveOutput,
} from './types.js';

import {
  registerOk,
  deprecateOk,
  deprecateNotfound,
  deprecateInvalidStatus,
  disableOk,
  disableNotfound,
  disableInvalidStatus,
  authorizeOk,
  authorizeNotfound,
  checkAccessAllowed,
  checkAccessDenied,
  checkAccessNotfound,
  listActiveOk,
} from './types.js';

export interface ToolRegistryError {
  readonly code: string;
  readonly message: string;
}

const toStorageError = (error: unknown): ToolRegistryError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const authorizationKey = (tool_id: string, model: string, process_ref: string): string =>
  `auth_${tool_id}_${model}_${process_ref}`;

export interface ToolRegistryHandler {
  readonly register: (
    input: ToolRegistryRegisterInput,
    storage: ToolRegistryStorage,
  ) => TE.TaskEither<ToolRegistryError, ToolRegistryRegisterOutput>;
  readonly deprecate: (
    input: ToolRegistryDeprecateInput,
    storage: ToolRegistryStorage,
  ) => TE.TaskEither<ToolRegistryError, ToolRegistryDeprecateOutput>;
  readonly disable: (
    input: ToolRegistryDisableInput,
    storage: ToolRegistryStorage,
  ) => TE.TaskEither<ToolRegistryError, ToolRegistryDisableOutput>;
  readonly authorize: (
    input: ToolRegistryAuthorizeInput,
    storage: ToolRegistryStorage,
  ) => TE.TaskEither<ToolRegistryError, ToolRegistryAuthorizeOutput>;
  readonly checkAccess: (
    input: ToolRegistryCheckAccessInput,
    storage: ToolRegistryStorage,
  ) => TE.TaskEither<ToolRegistryError, ToolRegistryCheckAccessOutput>;
  readonly listActive: (
    input: ToolRegistryListActiveInput,
    storage: ToolRegistryStorage,
  ) => TE.TaskEither<ToolRegistryError, ToolRegistryListActiveOutput>;
}

// --- Implementation ---

export const toolRegistryHandler: ToolRegistryHandler = {
  register: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const existing = await storage.get('tool_registry', input.tool_id);
          const previousVersion = existing ? Number(existing['version'] ?? 0) : 0;
          const newVersion = previousVersion + 1;
          const now = new Date().toISOString();
          await storage.put('tool_registry', input.tool_id, {
            tool_id: input.tool_id,
            name: input.name,
            description: input.description,
            schema: input.schema,
            version: newVersion,
            status: 'active',
            createdAt: existing ? String(existing['createdAt']) : now,
            updatedAt: now,
          });
          return registerOk(input.tool_id, newVersion);
        },
        toStorageError,
      ),
    ),

  deprecate: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('tool_registry', input.tool_id),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                deprecateNotfound(`Tool '${input.tool_id}' not found`),
              ),
            (existing) => {
              const status = String(existing['status']);
              if (status !== 'active') {
                return TE.right(
                  deprecateInvalidStatus(
                    `Cannot deprecate: tool is in '${status}' status, expected 'active'`,
                  ),
                );
              }
              return TE.tryCatch(
                async () => {
                  const now = new Date().toISOString();
                  await storage.put('tool_registry', input.tool_id, {
                    ...existing,
                    status: 'deprecated',
                    deprecation_reason: input.reason,
                    updatedAt: now,
                  });
                  return deprecateOk(input.tool_id);
                },
                toStorageError,
              );
            },
          ),
        ),
      ),
    ),

  disable: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('tool_registry', input.tool_id),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                disableNotfound(`Tool '${input.tool_id}' not found`),
              ),
            (existing) => {
              const status = String(existing['status']);
              if (status !== 'deprecated') {
                return TE.right(
                  disableInvalidStatus(
                    `Cannot disable: tool is in '${status}' status, expected 'deprecated'`,
                  ),
                );
              }
              return TE.tryCatch(
                async () => {
                  const now = new Date().toISOString();
                  await storage.put('tool_registry', input.tool_id, {
                    ...existing,
                    status: 'disabled',
                    updatedAt: now,
                  });
                  return disableOk(input.tool_id);
                },
                toStorageError,
              );
            },
          ),
        ),
      ),
    ),

  authorize: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('tool_registry', input.tool_id),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                authorizeNotfound(`Tool '${input.tool_id}' not found`),
              ),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const key = authorizationKey(input.tool_id, input.model, input.process_ref);
                  const now = new Date().toISOString();
                  await storage.put('tool_authorization', key, {
                    tool_id: input.tool_id,
                    model: input.model,
                    process_ref: input.process_ref,
                    createdAt: now,
                  });
                  return authorizeOk(input.tool_id, input.model, input.process_ref);
                },
                toStorageError,
              ),
          ),
        ),
      ),
    ),

  checkAccess: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('tool_registry', input.tool_id),
        toStorageError,
      ),
      TE.chain((toolRecord) =>
        pipe(
          O.fromNullable(toolRecord),
          O.fold(
            () =>
              TE.right(
                checkAccessNotfound(`Tool '${input.tool_id}' not found`),
              ),
            (tool) => {
              const status = String(tool['status']);
              if (status === 'disabled') {
                return TE.right(
                  checkAccessDenied(input.tool_id, 'Tool is disabled'),
                );
              }
              return TE.tryCatch(
                async () => {
                  const key = authorizationKey(input.tool_id, input.model, input.process_ref);
                  const authRecord = await storage.get('tool_authorization', key);
                  if (!authRecord) {
                    return checkAccessDenied(
                      input.tool_id,
                      `No authorization for model '${input.model}' in process '${input.process_ref}'`,
                    );
                  }
                  return checkAccessAllowed(input.tool_id, String(tool['schema']));
                },
                toStorageError,
              );
            },
          ),
        ),
      ),
    ),

  listActive: (_input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const records = await storage.find('tool_registry');
          const activeTools = records
            .filter((r) => String(r['status']) === 'active')
            .map((r) => ({
              tool_id: String(r['tool_id']),
              name: String(r['name']),
              description: String(r['description']),
              version: Number(r['version'] ?? 1),
            }));
          return listActiveOk(JSON.stringify(activeTools));
        },
        toStorageError,
      ),
    ),
};
