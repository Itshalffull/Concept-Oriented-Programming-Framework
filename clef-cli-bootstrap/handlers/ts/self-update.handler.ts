import type { ConceptHandler, ConceptStorage } from '../../runtime/types';
import { randomUUID } from 'crypto';
import { existsSync, copyFileSync, renameSync } from 'fs';

const REGISTRY_URL = process.env.CLEF_REGISTRY_URL ?? 'http://localhost:4002';

export const selfUpdateHandler: ConceptHandler = {
  async check(input: Record<string, unknown>, storage: ConceptStorage) {
    const currentVersion = input.current_version as string;
    const platform = input.platform as string;

    try {
      const res = await globalThis.fetch(
        `${REGISTRY_URL}/api/downloads/resolve/clef-cli/${platform}?version_range=latest`,
      );
      if (!res.ok) {
        return { variant: 'current' };
      }
      const data = await res.json() as Record<string, unknown>;
      if (data.version === currentVersion) {
        return { variant: 'current' };
      }

      const id = randomUUID();
      await storage.put('update', id, {
        currentVersion, platform,
        latestVersion: data.version,
        downloadUrl: data.artifact_url,
        contentHash: data.content_hash,
        status: 'idle',
      });

      return {
        variant: 'available',
        update: id,
        latest_version: data.version,
        download_url: data.artifact_url,
        content_hash: data.content_hash,
        size_bytes: data.size_bytes ?? 0,
      };
    } catch (err) {
      return { variant: 'error', message: String(err) };
    }
  },

  async apply(input: Record<string, unknown>, storage: ConceptStorage) {
    const update = input.update as string;
    const binaryPath = input.binary_path as string;

    const record = await storage.get('update', update);
    if (!record) {
      return { variant: 'error', message: 'Update not found' };
    }

    try {
      const backupPath = `${binaryPath}.backup`;
      if (existsSync(binaryPath)) {
        copyFileSync(binaryPath, backupPath);
      }

      await storage.put('update', update, {
        ...record,
        binaryPath,
        previousBinaryPath: backupPath,
        status: 'done',
      });

      return { variant: 'ok', previous_path: backupPath };
    } catch (err) {
      await storage.put('update', update, { ...record, status: 'failed' });
      return { variant: 'error', message: String(err) };
    }
  },

  async rollback(input: Record<string, unknown>, storage: ConceptStorage) {
    const update = input.update as string;

    const record = await storage.get('update', update);
    if (!record) {
      return { variant: 'error', message: 'Update not found' };
    }

    const prevPath = record.previousBinaryPath as string;
    if (!prevPath || !existsSync(prevPath)) {
      return { variant: 'no_backup' };
    }

    try {
      renameSync(prevPath, record.binaryPath as string);
      await storage.put('update', update, { ...record, status: 'idle' });
      return { variant: 'ok' };
    } catch (err) {
      return { variant: 'error', message: String(err) };
    }
  },

  async dismiss(input: Record<string, unknown>, storage: ConceptStorage) {
    const update = input.update as string;

    const record = await storage.get('update', update);
    if (!record) {
      return { variant: 'notfound' };
    }

    await storage.del('update', update);
    return { variant: 'ok' };
  },
};
