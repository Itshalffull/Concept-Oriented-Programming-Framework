// MediaAsset Concept Implementation
// Source-abstracted asset facade with metadata extraction and thumbnail generation.
import type { ConceptHandler } from '@clef/runtime';

export const mediaAssetHandler: ConceptHandler = {
  async createMedia(input, storage) {
    const asset = input.asset as string;
    const source = input.source as string;
    const file = input.file as string;

    const existing = await storage.get('mediaAsset', asset);
    if (existing) {
      return { variant: 'error', message: 'Asset already exists' };
    }

    const now = new Date().toISOString();

    await storage.put('mediaAsset', asset, {
      asset,
      sourcePlugin: source,
      originalFile: file,
      metadata: '',
      thumbnail: '',
      createdAt: now,
      updatedAt: now,
    });

    return { variant: 'ok', asset };
  },

  async extractMetadata(input, storage) {
    const asset = input.asset as string;

    const existing = await storage.get('mediaAsset', asset);
    if (!existing) {
      return { variant: 'notfound', message: 'Asset does not exist' };
    }

    const file = existing.originalFile as string;
    const source = existing.sourcePlugin as string;
    const now = new Date().toISOString();

    // Simulate metadata extraction based on file type and source plugin
    const extension = file.split('.').pop() || 'unknown';
    const metadata = JSON.stringify({
      fileName: file,
      source,
      fileType: extension,
      extractedAt: now,
    });

    await storage.put('mediaAsset', asset, {
      ...existing,
      metadata,
      updatedAt: now,
    });

    return { variant: 'ok', metadata };
  },

  async generateThumbnail(input, storage) {
    const asset = input.asset as string;

    const existing = await storage.get('mediaAsset', asset);
    if (!existing) {
      return { variant: 'notfound', message: 'Asset does not exist' };
    }

    const file = existing.originalFile as string;
    const now = new Date().toISOString();

    // Simulate thumbnail generation
    const thumbnail = `thumb_${file}`;

    await storage.put('mediaAsset', asset, {
      ...existing,
      thumbnail,
      updatedAt: now,
    });

    return { variant: 'ok', thumbnail };
  },

  async getMedia(input, storage) {
    const asset = input.asset as string;

    const existing = await storage.get('mediaAsset', asset);
    if (!existing) {
      return { variant: 'notfound', message: 'Asset does not exist' };
    }

    return {
      variant: 'ok',
      asset,
      metadata: existing.metadata as string,
      thumbnail: existing.thumbnail as string,
    };
  },
};
