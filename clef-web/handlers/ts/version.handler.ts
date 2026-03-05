import { randomUUID } from 'crypto';
import type { ConceptHandler, ConceptStorage } from '../../runtime/types';

export const versionHandler: ConceptHandler = {
  async record(input: Record<string, unknown>, storage: ConceptStorage) {
    const { slug, content, published_by } = input as {
      slug: string; content: string; published_by: string;
    };

    // Find existing versions for this slug to determine the next version number
    const existing = await storage.find('version_record', { slug });
    const versionNumber = existing.length + 1;

    const id = randomUUID();
    await storage.put('version_record', id, {
      id,
      slug,
      content,
      version_number: versionNumber,
      published_at: new Date().toISOString(),
      published_by,
    });

    return { variant: 'ok', version: id, version_number: versionNumber };
  },

  async get(input: Record<string, unknown>, storage: ConceptStorage) {
    const { slug, version_number } = input as {
      slug: string; version_number: number;
    };

    const versions = await storage.find('version_record', { slug, version_number });
    if (versions.length === 0) return { variant: 'notfound', slug };

    const record = versions[0];
    return { variant: 'ok', version: record.id, content: record.content };
  },

  async list(input: Record<string, unknown>, storage: ConceptStorage) {
    const { slug } = input as { slug: string };

    const versions = await storage.find('version_record', { slug });
    const mapped = versions.map((v) => ({
      version_number: v.version_number,
      published_at: v.published_at,
      published_by: v.published_by,
    }));

    return { variant: 'ok', versions: mapped };
  },

  async rollback(input: Record<string, unknown>, storage: ConceptStorage) {
    const { slug, version_number } = input as {
      slug: string; version_number: number;
    };

    const versions = await storage.find('version_record', { slug, version_number });
    if (versions.length === 0) return { variant: 'notfound', slug };

    return { variant: 'ok', version: versions[0].id };
  },
};
