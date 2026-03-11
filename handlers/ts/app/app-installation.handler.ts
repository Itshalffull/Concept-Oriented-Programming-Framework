import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.js';

function toInstallation(record: Record<string, unknown>) {
  return {
    installation: String(record.id ?? ''),
    name: String(record.name ?? ''),
    version: String(record.version ?? ''),
    status: String(record.status ?? ''),
    registry: String(record.registry ?? ''),
    description: typeof record.description === 'string' ? record.description : '',
    concepts: Number(record.concepts ?? 0),
    syncs: Number(record.syncs ?? 0),
  };
}

export const appInstallationHandler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    const installation = String(input.installation ?? '');
    await storage.put('installation', installation, {
      id: installation,
      name: String(input.name ?? ''),
      version: String(input.version ?? ''),
      status: String(input.status ?? ''),
      registry: String(input.registry ?? ''),
      description: typeof input.description === 'string' ? input.description : '',
      concepts: Number(input.concepts ?? 0),
      syncs: Number(input.syncs ?? 0),
    });
    return { variant: 'ok', installation };
  },

  async list(input: Record<string, unknown>, storage: ConceptStorage) {
    const status = typeof input.status === 'string' && input.status.trim() ? String(input.status) : undefined;
    const installations = status
      ? await storage.find('installation', { status })
      : await storage.find('installation', {});
    return { variant: 'ok', installations: installations.map((record) => toInstallation(record)) };
  },
};

export default appInstallationHandler;
