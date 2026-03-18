// @migrated dsl-constructs 2026-03-18
// MediaAsset Concept Implementation
// Source-abstracted asset facade with metadata extraction and thumbnail generation.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { wrapFunctional } from '../../../runtime/functional-compat.ts';

const mediaAssetHandlerFunctional: FunctionalConceptHandler = {
  createMedia(input: Record<string, unknown>) {
    const asset = input.asset as string;
    const source = input.source as string;
    const file = input.file as string;

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
          metadata: '',
          thumbnail: '',
          createdAt: now,
          updatedAt: now,
        });
        return complete(b2, 'ok', { asset });
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

  getMedia(input: Record<string, unknown>) {
    const asset = input.asset as string;

    let p = createProgram();
    p = spGet(p, 'mediaAsset', asset, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'ok', { asset, metadata: '', thumbnail: '' }),
      (b) => complete(b, 'notfound', { message: 'Asset does not exist' }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

/** Backward-compatible imperative wrapper — delegates to interpret(). */
export const mediaAssetHandler = wrapFunctional(mediaAssetHandlerFunctional);
/** The raw functional handler returning StorageProgram. */
export { mediaAssetHandlerFunctional };
