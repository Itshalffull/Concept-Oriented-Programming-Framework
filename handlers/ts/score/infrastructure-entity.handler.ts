// @migrated dsl-constructs 2026-03-18
// InfrastructureEntity Concept Implementation
//
// Queryable representation of storage and transport adapter
// configurations. Tracks which adapters are registered, their
// backends, configurations, and relationships to concepts and
// runtimes. Enables infrastructure topology queries and shared
// backend analysis.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, merge, branch, complete, completeFrom,
  mapBindings, putFrom, mergeFrom, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _handler: FunctionalConceptHandler = {

  register(input: Record<string, unknown>) {
    let p = createProgram();
    const name = input.name as string;
    const kind = input.kind as string;
    const sourceFile = input.sourceFile as string;
    const backend = input.backend as string;
    const config = input.config as string;

    const key = `adapter:${name}:${kind}`;
    p = get(p, 'infrastructure', key, 'existing');
    if (existing) {
      return complete(p, 'alreadyRegistered', { existing: existing.id }) as StorageProgram<Result>;
    }

    const id = crypto.randomUUID();
    const parsedConfig = config ? JSON.parse(config) : {};

    p = put(p, 'infrastructure', key, {
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

    return complete(p, 'ok', { adapter: id }) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    let p = createProgram();
    const name = input.name as string;
    const kind = input.kind as string;

    p = get(p, 'infrastructure', `adapter:${name}:${kind}`, 'entry');
    if (!entry) {
      return complete(p, 'notfound', {}) as StorageProgram<Result>;
    }

    return complete(p, 'ok', { adapter: entry.id }) as StorageProgram<Result>;
  },

  findByBackend(input: Record<string, unknown>) {
    let p = createProgram();
    const backend = input.backend as string;
    p = find(p, 'infrastructure', { backend }, 'all');

    return complete(p, 'ok', { adapters: JSON.stringify(all) }) as StorageProgram<Result>;
  },

  findByConcept(input: Record<string, unknown>) {
    let p = createProgram();
    const concept = input.concept as string;
    p = find(p, 'infrastructure', 'all');

    const matched = all.filter(a => {
      const bound = JSON.parse(a.boundConcepts as string || '[]');
      return bound.includes(concept);
    });

    const result = matched.map(a => ({
      name: a.name,
      kind: a.kind,
      backend: a.backend,
    }));

    return complete(p, 'ok', { adapters: JSON.stringify(result) }) as StorageProgram<Result>;
  },

  findByRuntime(input: Record<string, unknown>) {
    let p = createProgram();
    const runtime = input.runtime as string;
    p = find(p, 'infrastructure', { boundRuntime: runtime }, 'all');

    return complete(p, 'ok', { adapters: JSON.stringify(all) }) as StorageProgram<Result>;
  },

  sharedBackends(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'infrastructure', 'all');

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

    return complete(p, 'ok', { groups: JSON.stringify(groups) }) as StorageProgram<Result>;
  },

  networkTopology(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'infrastructure', { kind: 'transport' }, 'all');

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

    return complete(p, 'ok', { graph: JSON.stringify({ nodes, edges }) }) as StorageProgram<Result>;
  },
};

export const infrastructureEntityHandler = autoInterpret(_handler);
