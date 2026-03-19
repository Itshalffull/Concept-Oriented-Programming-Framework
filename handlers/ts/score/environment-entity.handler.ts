// EnvironmentEntity Concept Implementation
//
// Queryable representation of environment configuration, secret
// bindings, and config overrides across deployment environments.
// Enables cross-environment comparison, secret auditing, and
// feature flag management queries.

import type { ConceptHandler, ConceptStorage } from '@clef/runtime';

export const environmentEntityHandler: ConceptHandler = {

  async register(input, storage) {
    const name = input.name as string;
    const environment = input.environment as string;
    const kind = input.kind as string;
    const value = input.value as string;
    const source = input.source as string;

    const key = `env:${name}:${environment}`;
    const existing = await storage.get('environment-entries', key);

    const id = existing ? (existing.id as string) : crypto.randomUUID();
    const now = new Date().toISOString();

    await storage.put('environment-entries', key, {
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
      return { variant: 'updated', existing: id };
    }

    return { variant: 'ok', entry: id };
  },

  async get(input, storage) {
    const name = input.name as string;
    const environment = input.environment as string;

    const entry = await storage.get('environment-entries', `env:${name}:${environment}`);
    if (!entry) {
      return { variant: 'notfound' };
    }

    return { variant: 'ok', entry: entry.id };
  },

  async findByEnvironment(input, storage) {
    const environment = input.environment as string;
    const all = await storage.find('environment-entries', { environment });

    const entries = all.map(e => ({
      name: e.name,
      kind: e.kind,
      value: e.sensitive === 'true' ? '***' : e.value,
      source: e.source,
      boundRuntime: e.boundRuntime || '',
      sensitive: e.sensitive === 'true',
    }));

    return { variant: 'ok', entries: JSON.stringify(entries) };
  },

  async findByConcept(input, storage) {
    const concept = input.concept as string;
    const all = await storage.find('environment-entries', { boundConcept: concept });

    return { variant: 'ok', entries: JSON.stringify(all) };
  },

  async findByRuntime(input, storage) {
    const runtime = input.runtime as string;
    const all = await storage.find('environment-entries', { boundRuntime: runtime });

    return { variant: 'ok', entries: JSON.stringify(all) };
  },

  async diffEnvironments(input, storage) {
    const envA = input.envA as string;
    const envB = input.envB as string;

    const entriesA = await storage.find('environment-entries', { environment: envA });
    const entriesB = await storage.find('environment-entries', { environment: envB });

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
      return { variant: 'same' };
    }

    return { variant: 'ok', differences: JSON.stringify(differences) };
  },

  async secretsAudit(input, storage) {
    const environment = input.environment as string;
    const all = await storage.find('environment-entries', { environment });
    const secrets = all.filter(e => e.kind === 'secret');

    const result = secrets.map(s => ({
      name: s.name,
      source: s.source,
      boundRuntime: s.boundRuntime || '',
      lastRotated: '',
    }));

    return { variant: 'ok', secrets: JSON.stringify(result) };
  },

  async featureFlags(input, storage) {
    const environment = input.environment as string;
    const all = await storage.find('environment-entries', { environment });
    const flags = all.filter(e => e.kind === 'feature-flag');

    const result = flags.map(f => ({
      name: f.name,
      value: f.value,
      boundConcept: f.boundConcept || '',
    }));

    return { variant: 'ok', flags: JSON.stringify(result) };
  },
};
