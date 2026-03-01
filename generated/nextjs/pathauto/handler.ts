// Pathauto concept handler — automatic URL path generation from content patterns.
// Implements template-based path construction, string cleaning/slugification,
// and bulk alias generation with deduplication.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  PathautoStorage,
  PathautoGenerateAliasInput,
  PathautoGenerateAliasOutput,
  PathautoBulkGenerateInput,
  PathautoBulkGenerateOutput,
  PathautoCleanStringInput,
  PathautoCleanStringOutput,
} from './types.js';

import {
  generateAliasOk,
  generateAliasNotfound,
  bulkGenerateOk,
  bulkGenerateNotfound,
  cleanStringOk,
} from './types.js';

export interface PathautoError {
  readonly code: string;
  readonly message: string;
}

export interface PathautoHandler {
  readonly generateAlias: (
    input: PathautoGenerateAliasInput,
    storage: PathautoStorage,
  ) => TE.TaskEither<PathautoError, PathautoGenerateAliasOutput>;
  readonly bulkGenerate: (
    input: PathautoBulkGenerateInput,
    storage: PathautoStorage,
  ) => TE.TaskEither<PathautoError, PathautoBulkGenerateOutput>;
  readonly cleanString: (
    input: PathautoCleanStringInput,
    storage: PathautoStorage,
  ) => TE.TaskEither<PathautoError, PathautoCleanStringOutput>;
}

// --- Pure helpers ---

const cleanForUrl = (str: string): string =>
  str
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritical marks
    .replace(/[^\w\s-]/g, '')        // Remove non-word characters
    .replace(/\s+/g, '-')            // Spaces to hyphens
    .replace(/-+/g, '-')             // Collapse multiple hyphens
    .replace(/^-+|-+$/g, '');        // Trim leading/trailing hyphens

const applyPattern = (pattern: string, entityData: Record<string, unknown>): string => {
  // Replace [token] placeholders in the pattern with entity field values
  // e.g. "/content/[type]/[title]" with {type: "blog", title: "Hello World"}
  //   => "/content/blog/hello-world"
  return pattern.replace(/\[([^\]]+)\]/g, (_match, token: string) => {
    const value = entityData[token];
    if (value === undefined || value === null) {
      return token;
    }
    return cleanForUrl(String(value));
  });
};

const ensureLeadingSlash = (path: string): string =>
  path.startsWith('/') ? path : `/${path}`;

const toStorageError = (error: unknown): PathautoError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const pathautoHandler: PathautoHandler = {
  generateAlias: (input, storage) =>
    pipe(
      // Look up the entity to extract field values for pattern substitution
      TE.tryCatch(
        () => storage.get('entity', input.entity),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(generateAliasNotfound()),
            (entityData) =>
              TE.tryCatch(
                async () => {
                  const rawPath = applyPattern(input.pattern, entityData);
                  const alias = ensureLeadingSlash(rawPath);
                  const now = new Date().toISOString();

                  // Store the alias mapping for reverse lookups
                  await storage.put('pathauto', alias, {
                    alias,
                    entity: input.entity,
                    pattern: input.pattern,
                    createdAt: now,
                  });

                  return generateAliasOk(alias);
                },
                toStorageError,
              ),
          ),
        ),
      ),
    ),

  bulkGenerate: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          // Parse the entities string as JSON array of entity IDs
          let entityIds: readonly string[];
          try {
            const parsed = JSON.parse(input.entities);
            entityIds = Array.isArray(parsed) ? parsed : [input.entities];
          } catch {
            entityIds = input.entities.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
          }

          if (entityIds.length === 0) {
            return null; // Signal notfound
          }

          const aliases: string[] = [];

          for (const entityId of entityIds) {
            const entityData = await storage.get('entity', entityId);
            if (entityData !== null) {
              const rawPath = applyPattern(input.pattern, entityData);
              const alias = ensureLeadingSlash(rawPath);
              const now = new Date().toISOString();

              await storage.put('pathauto', alias, {
                alias,
                entity: entityId,
                pattern: input.pattern,
                createdAt: now,
              });

              aliases.push(alias);
            }
          }

          return aliases;
        },
        toStorageError,
      ),
      TE.chain((result) =>
        pipe(
          O.fromNullable(result),
          O.fold(
            () => TE.right(bulkGenerateNotfound()),
            (aliases) =>
              aliases.length === 0
                ? TE.right(bulkGenerateNotfound())
                : TE.right(bulkGenerateOk(JSON.stringify(aliases))),
          ),
        ),
      ),
    ),

  cleanString: (input, _storage) =>
    pipe(
      TE.right(cleanForUrl(input.input)),
      TE.map((cleaned) => cleanStringOk(cleaned)),
    ),
};
