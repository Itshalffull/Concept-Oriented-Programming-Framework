import type { ConceptHandler } from '@copf/kernel';

export const fileManagementHandler: ConceptHandler = {
  async upload(input, storage) {
    const file = input.file as string;
    const data = input.data as string;
    const mimeType = input.mimeType as string;

    const existing = await storage.get('file', file);
    if (existing) {
      return { variant: 'error', message: 'File already exists' };
    }

    await storage.put('file', file, {
      file,
      data,
      mimeType,
      usages: JSON.stringify([]),
    });

    return { variant: 'ok', file };
  },

  async addUsage(input, storage) {
    const file = input.file as string;
    const entity = input.entity as string;

    const record = await storage.get('file', file);
    if (!record) {
      return { variant: 'notfound', message: 'File not found' };
    }

    const usages: string[] = JSON.parse((record.usages as string) || '[]');
    if (!usages.includes(entity)) {
      usages.push(entity);
    }
    await storage.put('file', file, { ...record, usages: JSON.stringify(usages) });

    return { variant: 'ok' };
  },

  async removeUsage(input, storage) {
    const file = input.file as string;
    const entity = input.entity as string;

    const record = await storage.get('file', file);
    if (!record) {
      return { variant: 'notfound', message: 'File not found' };
    }

    const usages: string[] = JSON.parse((record.usages as string) || '[]');
    const filtered = usages.filter((u) => u !== entity);
    await storage.put('file', file, { ...record, usages: JSON.stringify(filtered) });

    return { variant: 'ok' };
  },

  async garbageCollect(_input, storage) {
    const allFiles = await storage.find('file');
    let removed = 0;

    for (const record of allFiles) {
      const usages: string[] = JSON.parse((record.usages as string) || '[]');
      if (usages.length === 0) {
        await storage.del('file', record.file as string);
        removed++;
      }
    }

    return { variant: 'ok', removed };
  },

  async getFile(input, storage) {
    const file = input.file as string;

    const record = await storage.get('file', file);
    if (!record) {
      return { variant: 'notfound', message: 'File not found' };
    }

    return {
      variant: 'ok',
      data: record.data as string,
      mimeType: record.mimeType as string,
    };
  },
};
