// @clef-handler style=functional
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
    p = branch(p,
      (bindings) => !!bindings.existing,
      (b) => completeFrom(b, 'alreadyRegistered', (bindings) => {
        const existing = bindings.existing as Record<string, unknown>;
        return { existing: existing.id };
      }),
      (b) => {
        const id = crypto.randomUUID();
        const parsedConfig = config ? JSON.parse(config) : {};

        let b2 = put(b, 'infrastructure', key, {
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

        return complete(b2, 'ok', { adapter: id });
      },
    ) as StorageProgram<Result>;

    return p;
  },

  get(input: Record<string, unknown>) {
    let p = createProgram();
    const name = input.name as string;
    const kind = input.kind as string;

    p = get(p, 'infrastructure', `adapter:${name}:${kind}`, 'entry');
    p = branch(p,
      (bindings) => !bindings.entry,
      (b) => complete(b, 'notfound', {}),
      (b) => completeFrom(b, 'ok', (bindings) => {
        const entry = bindings.entry as Record<string, unknown>;
        return { adapter: entry.id };
      }),
    ) as StorageProgram<Result>;

    return p;
  },

  findByBackend(input: Record<string, unknown>) {
    let p = createProgram();
    const backend = input.backend as string;
    p = find(p, 'infrastructure', { backend }, 'all');

    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.all || []) as Array<Record<string, unknown>>;
      return { adapters: JSON.stringify(all) };
    }) as StorageProgram<Result>;
  },

  findByConcept(input: Record<string, unknown>) {
    let p = createProgram();
    const concept = input.concept as string;
    p = find(p, 'infrastructure', {}, 'all');

    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.all || []) as Array<Record<string, unknown>>;
      const matched = all.filter(a => {
        const bound = JSON.parse(a.boundConcepts as string || '[]');
        return bound.includes(concept);
      });

      const result = matched.map(a => ({
        name: a.name,
        kind: a.kind,
        backend: a.backend,
      }));

      return { adapters: JSON.stringify(result) };
    }) as StorageProgram<Result>;
  },

  findByRuntime(input: Record<string, unknown>) {
    let p = createProgram();
    const runtime = input.runtime as string;
    p = find(p, 'infrastructure', { boundRuntime: runtime }, 'all');

    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.all || []) as Array<Record<string, unknown>>;
      return { adapters: JSON.stringify(all) };
    }) as StorageProgram<Result>;
  },

  sharedBackends(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'infrastructure', {}, 'all');

    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.all || []) as Array<Record<string, unknown>>;
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

      return { groups: JSON.stringify(groups) };
    }) as StorageProgram<Result>;
  },

  networkTopology(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'infrastructure', { kind: 'transport' }, 'all');

    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.all || []) as Array<Record<string, unknown>>;
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

      return { graph: JSON.stringify({ nodes, edges }) };
    }) as StorageProgram<Result>;
  },
};

export const infrastructureEntityHandler = autoInterpret(_handler);
