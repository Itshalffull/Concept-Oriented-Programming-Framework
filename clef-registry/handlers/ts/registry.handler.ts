import type { ConceptHandler, ConceptStorage } from '../../runtime/types';

export const registryHandler: ConceptHandler = {
  async publish(input: Record<string, unknown>, storage: ConceptStorage) {
    const name = input.name as string;
    const namespace = input.namespace as string;
    const version = input.version as string;
    const kind = input.kind as string;
    const artifact_hash = input.artifact_hash as string;
    const dependencies = (input.dependencies as Array<{ module_id: string; version_range: string }>) ?? [];
    const metadata = (input.metadata as string) ?? '{}';

    const key = `${namespace}/${name}@${version}`;
    const existing = await storage.get('modules', key);
    if (existing) {
      return { variant: 'exists' };
    }

    await storage.put('modules', key, {
      name,
      namespace,
      version,
      kind,
      artifact_hash,
      dependencies,
      metadata,
      published_at: new Date().toISOString(),
      owner: '',
    });

    return { variant: 'ok', module: key };
  },

  async lookup(input: Record<string, unknown>, storage: ConceptStorage) {
    const name = input.name as string;
    const namespace = input.namespace as string;
    const version = input.version as string;

    const key = `${namespace}/${name}@${version}`;
    const record = await storage.get('modules', key);
    if (!record) return { variant: 'notfound' };
    return { variant: 'ok', module: record };
  },

  async search(input: Record<string, unknown>, storage: ConceptStorage) {
    const query = input.query as string;
    const allModules = await storage.find('modules');

    const seen = new Set<string>();
    const results: Array<{ name: string; namespace: string; latest_version: string; description: string }> = [];

    for (const record of allModules) {
      const rName = record.name as string;
      const rNamespace = record.namespace as string;
      const rVersion = record.version as string;
      const fullName = `${rNamespace}/${rName}`;
      if (seen.has(fullName)) continue;
      if (rName.includes(query) || rNamespace.includes(query)) {
        seen.add(fullName);
        results.push({
          name: rName,
          namespace: rNamespace,
          latest_version: rVersion,
          description: '',
        });
      }
    }

    if (results.length === 0) return { variant: 'empty' };
    return { variant: 'ok', results };
  },

  async versions(input: Record<string, unknown>, storage: ConceptStorage) {
    const name = input.name as string;
    const namespace = input.namespace as string;

    const allModules = await storage.find('modules', { name, namespace });
    if (allModules.length === 0) return { variant: 'notfound' };

    const versions = allModules.map((record) => ({
      version: record.version as string,
      published_at: record.published_at as string,
      yanked: false,
    }));

    return { variant: 'ok', versions };
  },
};
