// @migrated dsl-constructs 2026-03-18
// EnvironmentEntity Concept Implementation
//
// Queryable representation of environment configuration, secret
// bindings, and config overrides across deployment environments.
// Enables cross-environment comparison, secret auditing, and
// feature flag management queries.

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
    const environment = input.environment as string;
    const kind = input.kind as string;
    const value = input.value as string;
    const source = input.source as string;

    const key = `env:${name}:${environment}`;
    p = get(p, 'environment-entries', key, 'existing');

    const id = existing ? (existing.id as string) : crypto.randomUUID();
    const now = new Date().toISOString();

    p = put(p, 'environment-entries', key, {
      id,
      name,
      environment,
      kind,
      value: kind === 'secret' ? '***' : value,
      source,
      sensitive: kind === 'secret' ? 'true' : 'false',
      boundRuntime: '',
      boundConcept: '',
      lastModified: now,
    });

    if (existing) {
      return complete(p, 'updated', { existing: id }) as StorageProgram<Result>;
    }

    return complete(p, 'ok', { entry: id }) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    let p = createProgram();
    const name = input.name as string;
    const environment = input.environment as string;

    p = get(p, 'environment-entries', `env:${name}:${environment}`, 'entry');
    if (!entry) {
      return complete(p, 'notfound', {}) as StorageProgram<Result>;
    }

    return complete(p, 'ok', { entry: entry.id }) as StorageProgram<Result>;
  },

  findByEnvironment(input: Record<string, unknown>) {
    let p = createProgram();
    const environment = input.environment as string;
    p = find(p, 'environment-entries', { environment }, 'all');

    const entries = all.map(e => ({
      name: e.name,
      kind: e.kind,
      value: e.sensitive === 'true' ? '***' : e.value,
      source: e.source,
      boundRuntime: e.boundRuntime || '',
      sensitive: e.sensitive === 'true',
    }));

    return complete(p, 'ok', { entries: JSON.stringify(entries) }) as StorageProgram<Result>;
  },

  findByConcept(input: Record<string, unknown>) {
    let p = createProgram();
    const concept = input.concept as string;
    p = find(p, 'environment-entries', { boundConcept: concept }, 'all');

    return complete(p, 'ok', { entries: JSON.stringify(all) }) as StorageProgram<Result>;
  },

  findByRuntime(input: Record<string, unknown>) {
    let p = createProgram();
    const runtime = input.runtime as string;
    p = find(p, 'environment-entries', { boundRuntime: runtime }, 'all');

    return complete(p, 'ok', { entries: JSON.stringify(all) }) as StorageProgram<Result>;
  },

  diffEnvironments(input: Record<string, unknown>) {
    let p = createProgram();
    const envA = input.envA as string;
    const envB = input.envB as string;

    p = find(p, 'environment-entries', { environment: envA }, 'entriesA');
    p = find(p, 'environment-entries', { environment: envB }, 'entriesB');

    const mapA = new Map(entriesA.map(e => [e.name as string, e]));
    const mapB = new Map(entriesB.map(e => [e.name as string, e]));
    const allNames = new Set([...mapA.keys(), ...mapB.keys()]);

    const differences: Array<{
      name: string;
      kind: string;
      aValue: string;
      bValue: string;
      onlyInA: boolean;
      onlyInB: boolean;
    }> = [];

    for (const name of allNames) {
      const a = mapA.get(name);
      const b = mapB.get(name);

      if (!a) {
        differences.push({
          name,
          kind: (b!.kind as string) || '',
          aValue: '',
          bValue: b!.sensitive === 'true' ? '***' : (b!.value as string) || '',
          onlyInA: false,
          onlyInB: true,
        });
      } else if (!b) {
        differences.push({
          name,
          kind: (a.kind as string) || '',
          aValue: a.sensitive === 'true' ? '***' : (a.value as string) || '',
          bValue: '',
          onlyInA: true,
          onlyInB: false,
        });
      } else if (a.value !== b.value) {
        differences.push({
          name,
          kind: (a.kind as string) || '',
          aValue: a.sensitive === 'true' ? '***' : (a.value as string) || '',
          bValue: b.sensitive === 'true' ? '***' : (b.value as string) || '',
          onlyInA: false,
          onlyInB: false,
        });
      }
    }

    if (differences.length === 0) {
      return complete(p, 'same', {}) as StorageProgram<Result>;
    }

    return complete(p, 'ok', { differences: JSON.stringify(differences) }) as StorageProgram<Result>;
  },

  secretsAudit(input: Record<string, unknown>) {
    let p = createProgram();
    const environment = input.environment as string;
    p = find(p, 'environment-entries', { environment }, 'all');
    const secrets = all.filter(e => e.kind === 'secret');

    const result = secrets.map(s => ({
      name: s.name,
      source: s.source,
      boundRuntime: s.boundRuntime || '',
      lastRotated: '',
    }));

    return complete(p, 'ok', { secrets: JSON.stringify(result) }) as StorageProgram<Result>;
  },

  featureFlags(input: Record<string, unknown>) {
    let p = createProgram();
    const environment = input.environment as string;
    p = find(p, 'environment-entries', { environment }, 'all');
    const flags = all.filter(e => e.kind === 'feature-flag');

    const result = flags.map(f => ({
      name: f.name,
      value: f.value,
      boundConcept: f.boundConcept || '',
    }));

    return complete(p, 'ok', { flags: JSON.stringify(result) }) as StorageProgram<Result>;
  },
};

export const environmentEntityHandler = autoInterpret(_handler);
