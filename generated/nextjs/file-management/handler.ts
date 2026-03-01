// FileManagement — File system operations: upload files with MIME types,
// track entity usage references, garbage-collect orphaned files, and retrieve content.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  FileManagementStorage,
  FileManagementUploadInput,
  FileManagementUploadOutput,
  FileManagementAddUsageInput,
  FileManagementAddUsageOutput,
  FileManagementRemoveUsageInput,
  FileManagementRemoveUsageOutput,
  FileManagementGarbageCollectInput,
  FileManagementGarbageCollectOutput,
  FileManagementGetFileInput,
  FileManagementGetFileOutput,
} from './types.js';

import {
  uploadOk,
  uploadError,
  addUsageOk,
  addUsageNotfound,
  removeUsageOk,
  removeUsageNotfound,
  garbageCollectOk,
  getFileOk,
  getFileNotfound,
} from './types.js';

export interface FileManagementError {
  readonly code: string;
  readonly message: string;
}

const toFileManagementError = (error: unknown): FileManagementError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

export interface FileManagementHandler {
  readonly upload: (
    input: FileManagementUploadInput,
    storage: FileManagementStorage,
  ) => TE.TaskEither<FileManagementError, FileManagementUploadOutput>;
  readonly addUsage: (
    input: FileManagementAddUsageInput,
    storage: FileManagementStorage,
  ) => TE.TaskEither<FileManagementError, FileManagementAddUsageOutput>;
  readonly removeUsage: (
    input: FileManagementRemoveUsageInput,
    storage: FileManagementStorage,
  ) => TE.TaskEither<FileManagementError, FileManagementRemoveUsageOutput>;
  readonly garbageCollect: (
    input: FileManagementGarbageCollectInput,
    storage: FileManagementStorage,
  ) => TE.TaskEither<FileManagementError, FileManagementGarbageCollectOutput>;
  readonly getFile: (
    input: FileManagementGetFileInput,
    storage: FileManagementStorage,
  ) => TE.TaskEither<FileManagementError, FileManagementGetFileOutput>;
}

// --- Implementation ---

export const fileManagementHandler: FileManagementHandler = {
  // Upload a file with its binary data and MIME type. Overwrites if the file key exists.
  upload: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          if (!input.data || input.data.length === 0) {
            return uploadError('File data cannot be empty');
          }
          await storage.put('file', input.file, {
            file: input.file,
            data: input.data,
            mimeType: input.mimeType,
            usages: [],
            uploadedAt: new Date().toISOString(),
          });
          return uploadOk(input.file);
        },
        toFileManagementError,
      ),
    ),

  // Record that an entity references this file. Returns notfound if file is not uploaded.
  addUsage: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('file', input.file),
        toFileManagementError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right<FileManagementError, FileManagementAddUsageOutput>(
                addUsageNotfound(`File '${input.file}' not found`),
              ),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const r = existing as Record<string, unknown>;
                  const usages = Array.isArray(r.usages)
                    ? [...(r.usages as readonly string[])]
                    : [];
                  if (!usages.includes(input.entity)) {
                    usages.push(input.entity);
                  }
                  await storage.put('file', input.file, { ...existing, usages });
                  return addUsageOk();
                },
                toFileManagementError,
              ),
          ),
        ),
      ),
    ),

  // Remove an entity's usage reference from a file. Returns notfound if file is missing.
  removeUsage: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('file', input.file),
        toFileManagementError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right<FileManagementError, FileManagementRemoveUsageOutput>(
                removeUsageNotfound(`File '${input.file}' not found`),
              ),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const r = existing as Record<string, unknown>;
                  const usages = Array.isArray(r.usages)
                    ? (r.usages as readonly string[]).filter((u) => u !== input.entity)
                    : [];
                  await storage.put('file', input.file, { ...existing, usages });
                  return removeUsageOk();
                },
                toFileManagementError,
              ),
          ),
        ),
      ),
    ),

  // Remove all files with zero usage references (orphaned files).
  garbageCollect: (_input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const allFiles = await storage.find('file');
          let removed = 0;
          for (const file of allFiles) {
            const r = file as Record<string, unknown>;
            const usages = Array.isArray(r.usages) ? r.usages : [];
            if (usages.length === 0) {
              const fileKey = String(r.file ?? '');
              if (fileKey) {
                await storage.delete('file', fileKey);
                removed += 1;
              }
            }
          }
          return garbageCollectOk(removed);
        },
        toFileManagementError,
      ),
    ),

  // Retrieve a file's data and MIME type. Returns notfound if the file key is unknown.
  getFile: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('file', input.file),
        toFileManagementError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right<FileManagementError, FileManagementGetFileOutput>(
                getFileNotfound(`File '${input.file}' not found`),
              ),
            (found) => {
              const r = found as Record<string, unknown>;
              return TE.right<FileManagementError, FileManagementGetFileOutput>(
                getFileOk(String(r.data ?? ''), String(r.mimeType ?? 'application/octet-stream')),
              );
            },
          ),
        ),
      ),
    ),
};
