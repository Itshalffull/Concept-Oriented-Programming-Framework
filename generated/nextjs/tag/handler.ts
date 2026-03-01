// Tag — Tagging system for attaching labels to entities, querying by tags,
// and managing tag hierarchies with rename support.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  TagStorage,
  TagAddTagInput,
  TagAddTagOutput,
  TagRemoveTagInput,
  TagRemoveTagOutput,
  TagGetByTagInput,
  TagGetByTagOutput,
  TagGetChildrenInput,
  TagGetChildrenOutput,
  TagRenameInput,
  TagRenameOutput,
} from './types.js';

import {
  addTagOk,
  addTagNotfound,
  removeTagOk,
  removeTagNotfound,
  getByTagOk,
  getChildrenOk,
  getChildrenNotfound,
  renameOk,
  renameNotfound,
} from './types.js';

export interface TagError {
  readonly code: string;
  readonly message: string;
}

const toTagError = (error: unknown): TagError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

export interface TagHandler {
  readonly addTag: (
    input: TagAddTagInput,
    storage: TagStorage,
  ) => TE.TaskEither<TagError, TagAddTagOutput>;
  readonly removeTag: (
    input: TagRemoveTagInput,
    storage: TagStorage,
  ) => TE.TaskEither<TagError, TagRemoveTagOutput>;
  readonly getByTag: (
    input: TagGetByTagInput,
    storage: TagStorage,
  ) => TE.TaskEither<TagError, TagGetByTagOutput>;
  readonly getChildren: (
    input: TagGetChildrenInput,
    storage: TagStorage,
  ) => TE.TaskEither<TagError, TagGetChildrenOutput>;
  readonly rename: (
    input: TagRenameInput,
    storage: TagStorage,
  ) => TE.TaskEither<TagError, TagRenameOutput>;
}

// --- Implementation ---

export const tagHandler: TagHandler = {
  // Attach a tag to an entity by storing the entity-tag association.
  // Uses a composite key so multiple entities can share the same tag.
  addTag: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('tag', input.tag),
        toTagError,
      ),
      TE.chain((existing) =>
        TE.tryCatch(
          async () => {
            const tagRecord = existing ?? { tag: input.tag, entities: [] as readonly string[] };
            const entities = Array.isArray((tagRecord as Record<string, unknown>).entities)
              ? [...((tagRecord as Record<string, unknown>).entities as readonly string[])]
              : [];
            if (!entities.includes(input.entity)) {
              entities.push(input.entity);
            }
            await storage.put('tag', input.tag, { ...tagRecord, tag: input.tag, entities });
            // Store reverse lookup: entity -> tags
            const entityRecord = await storage.get('entity_tags', input.entity);
            const tags = entityRecord && Array.isArray((entityRecord as Record<string, unknown>).tags)
              ? [...((entityRecord as Record<string, unknown>).tags as readonly string[])]
              : [];
            if (!tags.includes(input.tag)) {
              tags.push(input.tag);
            }
            await storage.put('entity_tags', input.entity, { entity: input.entity, tags });
            return addTagOk();
          },
          toTagError,
        ),
      ),
    ),

  // Remove a tag from an entity. Returns notfound if the tag does not exist.
  removeTag: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('tag', input.tag),
        toTagError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<TagError, TagRemoveTagOutput>(removeTagNotfound(`Tag '${input.tag}' not found`)),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const entities = Array.isArray((existing as Record<string, unknown>).entities)
                    ? ((existing as Record<string, unknown>).entities as readonly string[]).filter(
                        (e) => e !== input.entity,
                      )
                    : [];
                  await storage.put('tag', input.tag, { ...existing, entities });
                  return removeTagOk();
                },
                toTagError,
              ),
          ),
        ),
      ),
    ),

  // Retrieve all entities associated with a given tag.
  getByTag: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const record = await storage.get('tag', input.tag);
          const entities = record && Array.isArray((record as Record<string, unknown>).entities)
            ? ((record as Record<string, unknown>).entities as readonly string[]).join(',')
            : '';
          return getByTagOk(entities);
        },
        toTagError,
      ),
    ),

  // Get child tags of a parent tag from the tag hierarchy.
  getChildren: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('tag', input.tag),
        toTagError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<TagError, TagGetChildrenOutput>(getChildrenNotfound(`Tag '${input.tag}' not found`)),
            (found) => {
              const children = (found as Record<string, unknown>).children;
              const childrenStr = Array.isArray(children) ? (children as readonly string[]).join(',') : '';
              return TE.right<TagError, TagGetChildrenOutput>(getChildrenOk(childrenStr));
            },
          ),
        ),
      ),
    ),

  // Rename a tag, updating the stored record with a new display name.
  rename: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('tag', input.tag),
        toTagError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<TagError, TagRenameOutput>(renameNotfound(`Tag '${input.tag}' not found`)),
            (existing) =>
              TE.tryCatch(
                async () => {
                  await storage.put('tag', input.tag, { ...existing, name: input.name });
                  return renameOk();
                },
                toTagError,
              ),
          ),
        ),
      ),
    ),
};
