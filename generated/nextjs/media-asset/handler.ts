// MediaAsset concept handler — media file metadata management with creation,
// metadata extraction, thumbnail generation, and retrieval.
// Validates file types, extracts dimensions from file path conventions,
// and manages variant relationships.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  MediaAssetStorage,
  MediaAssetCreateMediaInput,
  MediaAssetCreateMediaOutput,
  MediaAssetExtractMetadataInput,
  MediaAssetExtractMetadataOutput,
  MediaAssetGenerateThumbnailInput,
  MediaAssetGenerateThumbnailOutput,
  MediaAssetGetMediaInput,
  MediaAssetGetMediaOutput,
} from './types.js';

import {
  createMediaOk,
  createMediaError,
  extractMetadataOk,
  extractMetadataNotfound,
  generateThumbnailOk,
  generateThumbnailNotfound,
  getMediaOk,
  getMediaNotfound,
} from './types.js';

export interface MediaAssetError {
  readonly code: string;
  readonly message: string;
}

export interface MediaAssetHandler {
  readonly createMedia: (
    input: MediaAssetCreateMediaInput,
    storage: MediaAssetStorage,
  ) => TE.TaskEither<MediaAssetError, MediaAssetCreateMediaOutput>;
  readonly extractMetadata: (
    input: MediaAssetExtractMetadataInput,
    storage: MediaAssetStorage,
  ) => TE.TaskEither<MediaAssetError, MediaAssetExtractMetadataOutput>;
  readonly generateThumbnail: (
    input: MediaAssetGenerateThumbnailInput,
    storage: MediaAssetStorage,
  ) => TE.TaskEither<MediaAssetError, MediaAssetGenerateThumbnailOutput>;
  readonly getMedia: (
    input: MediaAssetGetMediaInput,
    storage: MediaAssetStorage,
  ) => TE.TaskEither<MediaAssetError, MediaAssetGetMediaOutput>;
}

// --- Pure helpers ---

const ALLOWED_EXTENSIONS: ReadonlySet<string> = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico',
  'mp4', 'webm', 'ogg', 'mov', 'avi',
  'mp3', 'wav', 'flac', 'aac',
  'pdf', 'doc', 'docx',
]);

const IMAGE_EXTENSIONS: ReadonlySet<string> = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico',
]);

const extractExtension = (filename: string): string => {
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex === -1 || dotIndex === filename.length - 1) {
    return '';
  }
  return filename.slice(dotIndex + 1).toLowerCase();
};

const detectMimeType = (ext: string): string => {
  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
    bmp: 'image/bmp', ico: 'image/x-icon',
    mp4: 'video/mp4', webm: 'video/webm', ogg: 'video/ogg',
    mov: 'video/quicktime', avi: 'video/x-msvideo',
    mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac',
    aac: 'audio/aac',
    pdf: 'application/pdf', doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  return mimeMap[ext] ?? 'application/octet-stream';
};

const isImageExtension = (ext: string): boolean => IMAGE_EXTENSIONS.has(ext);

const toStorageError = (error: unknown): MediaAssetError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const mediaAssetHandler: MediaAssetHandler = {
  createMedia: (input, storage) => {
    const ext = extractExtension(input.file);

    if (ext.length === 0) {
      return TE.right(createMediaError('File has no extension, cannot determine type'));
    }

    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return TE.right(createMediaError(`File type '.${ext}' is not supported`));
    }

    return pipe(
      TE.tryCatch(
        async () => {
          const now = new Date().toISOString();
          const mimeType = detectMimeType(ext);

          await storage.put('mediaasset', input.asset, {
            asset: input.asset,
            source: input.source,
            file: input.file,
            extension: ext,
            mimeType,
            isImage: isImageExtension(ext),
            createdAt: now,
            updatedAt: now,
          });

          return createMediaOk(input.asset);
        },
        toStorageError,
      ),
    );
  },

  extractMetadata: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('mediaasset', input.asset),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                extractMetadataNotfound(`Media asset '${input.asset}' not found`),
              ),
            (found) => {
              const ext = typeof found['extension'] === 'string' ? found['extension'] as string : '';
              const mimeType = typeof found['mimeType'] === 'string' ? found['mimeType'] as string : detectMimeType(ext);
              const file = typeof found['file'] === 'string' ? found['file'] as string : '';

              const metadata = {
                asset: input.asset,
                file,
                extension: ext,
                mimeType,
                isImage: isImageExtension(ext),
                createdAt: found['createdAt'],
              };

              return pipe(
                TE.tryCatch(
                  async () => {
                    // Persist extracted metadata back to asset record
                    const now = new Date().toISOString();
                    const updated = {
                      ...found,
                      metadataExtractedAt: now,
                    };
                    await storage.put('mediaasset', input.asset, updated);
                    return extractMetadataOk(JSON.stringify(metadata));
                  },
                  toStorageError,
                ),
              );
            },
          ),
        ),
      ),
    ),

  generateThumbnail: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('mediaasset', input.asset),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                generateThumbnailNotfound(`Media asset '${input.asset}' not found`),
              ),
            (found) => {
              const ext = typeof found['extension'] === 'string' ? found['extension'] as string : '';

              if (!isImageExtension(ext)) {
                // Non-image assets get a placeholder thumbnail reference
                return TE.right(
                  generateThumbnailOk(`placeholder_${input.asset}`),
                );
              }

              // For images, generate a thumbnail variant identifier
              return pipe(
                TE.tryCatch(
                  async () => {
                    const thumbnailId = `thumb_${input.asset}`;
                    const file = typeof found['file'] === 'string' ? found['file'] as string : '';
                    const now = new Date().toISOString();

                    // Store the thumbnail as a variant of the original asset
                    await storage.put('mediaasset_variant', thumbnailId, {
                      parentAsset: input.asset,
                      variant: 'thumbnail',
                      file: `thumb_${file}`,
                      width: 150,
                      height: 150,
                      createdAt: now,
                    });

                    // Update the parent asset with thumbnail reference
                    const updated = {
                      ...found,
                      thumbnailId,
                      updatedAt: now,
                    };
                    await storage.put('mediaasset', input.asset, updated);

                    return generateThumbnailOk(thumbnailId);
                  },
                  toStorageError,
                ),
              );
            },
          ),
        ),
      ),
    ),

  getMedia: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('mediaasset', input.asset),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                getMediaNotfound(`Media asset '${input.asset}' not found`),
              ),
            (found) => {
              const ext = typeof found['extension'] === 'string' ? found['extension'] as string : '';
              const mimeType = typeof found['mimeType'] === 'string' ? found['mimeType'] as string : detectMimeType(ext);
              const file = typeof found['file'] === 'string' ? found['file'] as string : '';

              const metadata = JSON.stringify({
                file,
                extension: ext,
                mimeType,
                isImage: isImageExtension(ext),
                createdAt: found['createdAt'],
              });

              const thumbnailId = typeof found['thumbnailId'] === 'string'
                ? found['thumbnailId'] as string
                : '';

              return TE.right(
                getMediaOk(input.asset, metadata, thumbnailId),
              );
            },
          ),
        ),
      ),
    ),
};
