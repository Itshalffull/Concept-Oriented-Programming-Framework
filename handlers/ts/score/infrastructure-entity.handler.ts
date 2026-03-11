// InfrastructureEntity Concept Implementation
//
// Queryable representation of storage and transport adapter
// configurations. Tracks which adapters are registered, their
// backends, configurations, and relationships to concepts and
// runtimes. Enables infrastructure topology queries and shared
// backend analysis.

import type { ConceptHandler, ConceptStorage } from '@clef/runtime';

export const infrastructureEntityHandler: ConceptHandler = {

  async register(input, storage) {
    const name = input.name as string;
    const kind = input.kind as string;
    const sourceFile = input.sourceFile as string;
    const backend = input.backend as string;
    const config = input.config as string;

    const key = `adapter:${name}:${kind}`;
    const existing = await storage.get('infrastructure', key);
    if (existing) {
      return { variant: 'alreadyRegistered', existing: existing.id };
    }

    const id = crypto.randomUUID();
    const parsedConfig = config ? JSON.parse(config) : {};

    await storage.put('infrastructure', key, {
      id,
      name,
      kind,
      sourceFile,
      backend,
      config,
      symbol: `${name}-${kind}`,
      boundConcepts: JSON.stringify(parsedConfig.boundConcepts || []),
      boundRuntime: parsedConfig.boundRuntime || '',
      capabilities: JSON.stringify(parsedConfig.capabilities || []),
    });

    return { variant: 'ok', adapter: id };
  },

  async get(input, storage) {
    const name = input.name as string;
    const kind = input.kind as string;

    const entry = await storage.get('infrastructure', `adapter:${name}:${kind}`);
    if (!entry) {
      return { variant: 'notfound' };
    }

    return { variant: 'ok', adapter: entry.id };
  },

  async findByBackend(input, storage) {
    const backend = input.backend as string;
    const all = await storage.find('infrastructure', { backend });

    return { variant: 'ok', adapters: JSON.stringify(all) };
  },

  async findByConcept(input, storage) {
    const concept = input.concept as string;
    const all = await storage.find('infrastructure');

    const matched = all.filter(a => {
      const bound = JSON.parse(a.boundConcepts as string || '[]');
      return bound.includes(concept);
    });

    const result = matched.map(a => ({
      name: a.name,
      kind: a.kind,
      backend: a.backend,
    }));

    return { variant: 'ok', adapters: JSON.stringify(result) };
  },

  async findByRuntime(input, storage) {
    const runtime = input.runtime as string;
    const all = await storage.find('infrastructure', { boundRuntime: runtime });

    return { variant: 'ok', adapters: JSON.stringify(all) };
  },

  async sharedBackends(_input, storage) {
    const all = await storage.find('infrastructure');

    const backendMap = new Map<string, Array<{ adapter: string; kind: string; concepts: string[] }>>();
    for (const adapter of all) {
      const backendKey = `${adapter.backend}:${adapter.kind}`;
      if (!backendMap.has(backendKey)) {
        backendMap.set(backendKey, []);
      }
      backendMap.get(backendKey)!.push({
        adapter: adapter.name as string,
        kind: adapter.kind as string,
        concepts: JSON.parse(adapter.boundConcepts as string || '[]'),
      });
    }

    const groups: Array<{ backend: string; kind: string; adapter: string; concepts: string[] }> = [];
    for (const [key, adapters] of backendMap) {
      const [backend, kind] = key.split(':');
      for (const adapter of adapters) {
        groups.push({
          backend,
          kind,
          adapter: adapter.adapter,
          concepts: adapter.concepts,
        });
      }
    }

    return { variant: 'ok', groups: JSON.stringify(groups) };
  },

  async networkTopology(_input, storage) {
    const all = await storage.find('infrastructure', { kind: 'transport' });

    const runtimes = new Set<string>();
    const edges: Array<{ from: string; to: string; protocol: string; adapter: string }> = [];

    for (const adapter of all) {
      const config = adapter.config ? JSON.parse(adapter.config as string) : {};
      const from = config.from || adapter.boundRuntime || '';
      const to = config.to || '';

      if (from) runtimes.add(from);
      if (to) runtimes.add(to);

      if (from && to) {
        edges.push({
          from,
          to,
          protocol: adapter.backend as string,
          adapter: adapter.name as string,
        });
      }
    }

    const nodes = Array.from(runtimes).map(r => ({ id: r, kind: 'runtime', label: r }));

    return { variant: 'ok', graph: JSON.stringify({ nodes, edges }) };
  },
};
