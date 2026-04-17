// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// MediaAsset Concept Implementation
// Source-abstracted asset facade with metadata extraction and thumbnail generation.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _mediaAssetHandler: FunctionalConceptHandler = {
  createMedia(input: Record<string, unknown>) {
    const asset = input.asset as string;
    const source = input.source as string;
    const file = input.file as string;
    // context is opaque Bytes (stored as a string); callers pass JSON such as
    // {"focusedDocId":"doc-123","cursorPosition":42} for paste/drop dispatch syncs.
    // MediaAsset does not interpret the value -- it stores and echoes it unchanged.
    const context = (input.context as string) ?? '';

    let p = createProgram();
    p = spGet(p, 'mediaAsset', asset, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'error', { message: 'Asset already exists' }),
      (b) => {
        const now = new Date().toISOString();
        let b2 = put(b, 'mediaAsset', asset, {
          asset,
          sourcePlugin: source,
          originalFile: file,
          context,
          metadata: '',
          thumbnail: '',
          createdAt: now,
          updatedAt: now,
        });
        return complete(b2, 'ok', { asset, context });
      },
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  extractMetadata(input: Record<string, unknown>) {
    const asset = input.asset as string;

    let p = createProgram();
    p = spGet(p, 'mediaAsset', asset, 'existing');
    p = branch(p, 'existing',
      (b) => {
        const now = new Date().toISOString();
        const metadata = JSON.stringify({
          extractedAt: now,
        });
        let b2 = put(b, 'mediaAsset', asset, {
          metadata,
          updatedAt: now,
        });
        return complete(b2, 'ok', { metadata });
      },
      (b) => complete(b, 'notfound', { message: 'Asset does not exist' }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  generateThumbnail(input: Record<string, unknown>) {
    const asset = input.asset as string;

    let p = createProgram();
    p = spGet(p, 'mediaAsset', asset, 'existing');
    p = branch(p, 'existing',
      (b) => {
        const now = new Date().toISOString();
        const thumbnail = `thumb_${asset}`;
        let b2 = put(b, 'mediaAsset', asset, {
          thumbnail,
          updatedAt: now,
        });
        return complete(b2, 'ok', { thumbnail });
      },
      (b) => complete(b, 'notfound', { message: 'Asset does not exist' }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  setDimensions(input: Record<string, unknown>) {
    const asset = input.asset as string;
    const width = Number(input.width);
    const height = Number(input.height);

    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
      let p0 = createProgram();
      return complete(p0, 'error', { message: 'width and height must be positive integers' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    let p = createProgram();
    p = spGet(p, 'mediaAsset', asset, 'existing');
    p = branch(p, 'existing',
      (b) => {
        const now = new Date().toISOString();
        let b2 = put(b, 'mediaAsset', asset, { width, height, updatedAt: now });
        return complete(b2, 'ok', { asset, width, height });
      },
      (b) => complete(b, 'notfound', { message: 'Asset does not exist' }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'mediaAsset', {}, 'allAssets');
    return completeFrom(p, 'ok', (bindings) => {
      const raw = (bindings.allAssets as unknown[]) ?? [];
      // Denormalize the context JSON blob into flat projection-friendly fields.
      // The createMedia call stores { name, mimeType, capturedAt } as a JSON
      // string in `context`. The ProjectionSpec (media-asset-fields) expects
      // top-level keys: thumbnail, name, mimeType, fileSize, duration,
      // capturedAt, tags, album. We parse context and spread it so those keys
      // are available on each returned record.
      const items = raw.map((rec) => {
        const r = rec as Record<string, unknown>;
        let ctx: Record<string, unknown> = {};
        if (typeof r.context === 'string' && r.context.trim().startsWith('{')) {
          try { ctx = JSON.parse(r.context); } catch { /* ignore malformed context */ }
        }
        return {
          // identity
          asset: r.asset,
          // projection-spec keys (flat)
          thumbnail: r.thumbnail || '',
          name: ctx.name ?? r.originalFile ?? r.asset ?? '',
          mimeType: ctx.mimeType ?? '',
          fileSize: ctx.fileSize ?? r.fileSize ?? '',
          duration: ctx.duration ?? r.duration ?? '',
          capturedAt: ctx.capturedAt ?? r.createdAt ?? '',
          tags: ctx.tags ?? r.tags ?? [],
          album: ctx.album ?? r.album ?? '',
          // passthrough originals for detail views / non-projection consumers
          sourcePlugin: r.sourcePlugin,
          originalFile: r.originalFile,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        };
      });
      return { items: JSON.stringify(items) };
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  getMedia(input: Record<string, unknown>) {
    const asset = input.asset as string;

    let p = createProgram();
    p = spGet(p, 'mediaAsset', asset, 'existing');
    p = branch(p, 'existing',
      (b) => completeFrom(b, 'ok', (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return { asset, metadata: (existing.metadata as string) || '', thumbnail: (existing.thumbnail as string) || '' };
        }),
      (b) => complete(b, 'notfound', { message: 'Asset does not exist' }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const mediaAssetHandler = autoInterpret(_mediaAssetHandler);
