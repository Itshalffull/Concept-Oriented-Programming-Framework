// SuiteManifestEntity Concept Implementation
//
// Queryable representation of parsed suite manifests (suite.yaml).
// Covers concept lists, sync declarations, type parameter alignment,
// dependencies, and versioning. Enables cross-suite dependency
// analysis and composition queries.

import type { ConceptHandler, ConceptStorage } from '@clef/runtime';

export const suiteManifestEntityHandler: ConceptHandler = {

  async register(input, storage) {
    const name = input.name as string;
    const source = input.source as string;
    const manifest = input.manifest as string;

    const key = `suite:${name}`;
    const existing = await storage.get('suite-manifests', key);
    if (existing) {
      return { variant: 'alreadyRegistered', existing: existing.id };
    }

    const id = crypto.randomUUID();
    const parsed = manifest ? JSON.parse(manifest) : {};

    await storage.put('suite-manifests', key, {
      id,
      name,
      sourceFile: source,
      symbol: name,
      version: parsed.version || '0.0.0',
      description: parsed.description || '',
      concepts: JSON.stringify(parsed.concepts || []),
      syncs: JSON.stringify(parsed.syncs || []),
      dependencies: JSON.stringify(parsed.dependencies || []),
      optionalConcepts: JSON.stringify(parsed.optionalConcepts || []),
      typeParamBindings: JSON.stringify(parsed.typeParamBindings || {}),
      infrastructure: JSON.stringify(parsed.infrastructure || {}),
    });

    return { variant: 'ok', suite: id };
  },

  async get(input, storage) {
    const name = input.name as string;

    const entry = await storage.get('suite-manifests', `suite:${name}`);
    if (!entry) {
      return { variant: 'notfound' };
    }

    return { variant: 'ok', suite: entry.id };
  },

  async listAll(_input, storage) {
    const all = await storage.find('suite-manifests');

    const suites = all.map(s => ({
      name: s.name,
      version: s.version,
      conceptCount: JSON.parse(s.concepts as string || '[]').length,
      syncCount: JSON.parse(s.syncs as string || '[]').length,
    }));

    return { variant: 'ok', suites: JSON.stringify(suites) };
  },

  async findByConcept(input, storage) {
    const concept = input.concept as string;
    const all = await storage.find('suite-manifests');

    const matched = all.filter(s => {
      const concepts = JSON.parse(s.concepts as string || '[]');
      return concepts.some((c: { name: string } | string) =>
        (typeof c === 'string' ? c : c.name) === concept
      );
    });

    return { variant: 'ok', suites: JSON.stringify(matched) };
  },

  async findBySync(input, storage) {
    const sync = input.sync as string;
    const all = await storage.find('suite-manifests');

    const matched = all.filter(s => {
      const syncs = JSON.parse(s.syncs as string || '[]');
      return syncs.some((sy: { name: string } | string) =>
        (typeof sy === 'string' ? sy : sy.name) === sync
      );
    });

    return { variant: 'ok', suites: JSON.stringify(matched) };
  },

  async concepts(input, storage) {
    const suiteId = input.suite as string;

    const all = await storage.find('suite-manifests');
    const entry = all.find(s => s.id === suiteId);
    if (!entry) {
      return { variant: 'ok', concepts: '[]' };
    }

    return { variant: 'ok', concepts: entry.concepts as string || '[]' };
  },

  async syncs(input, storage) {
    const suiteId = input.suite as string;

    const all = await storage.find('suite-manifests');
    const entry = all.find(s => s.id === suiteId);
    if (!entry) {
      return { variant: 'ok', syncs: '[]' };
    }

    return { variant: 'ok', syncs: entry.syncs as string || '[]' };
  },

  async dependencyGraph(_input, storage) {
    const all = await storage.find('suite-manifests');

    const nodes = all.map(s => ({
      name: s.name,
      version: s.version,
    }));

    const edges: Array<{ from: string; to: string; constraint: string }> = [];
    for (const suite of all) {
      const deps = JSON.parse(suite.dependencies as string || '[]');
      for (const dep of deps) {
        const depName = typeof dep === 'string' ? dep : dep.name;
        const constraint = typeof dep === 'string' ? '*' : dep.version || '*';
        edges.push({
          from: suite.name as string,
          to: depName,
          constraint,
        });
      }
    }

    return { variant: 'ok', graph: JSON.stringify({ nodes, edges }) };
  },

  async transitiveDependencies(input, storage) {
    const suiteId = input.suite as string;

    const all = await storage.find('suite-manifests');
    const entry = all.find(s => s.id === suiteId);
    if (!entry) {
      return { variant: 'ok', dependencies: '[]' };
    }

    const result: Array<{ name: string; version: string; depth: number; via: string }> = [];
    const visited = new Set<string>();
    const queue: Array<{ name: string; depth: number; via: string }> = [];

    const directDeps = JSON.parse(entry.dependencies as string || '[]');
    for (const dep of directDeps) {
      const depName = typeof dep === 'string' ? dep : dep.name;
      queue.push({ name: depName, depth: 1, via: entry.name as string });
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current.name)) continue;
      visited.add(current.name);

      const depEntry = all.find(s => s.name === current.name);
      result.push({
        name: current.name,
        version: (depEntry?.version as string) || 'unknown',
        depth: current.depth,
        via: current.via,
      });

      if (depEntry) {
        const transitive = JSON.parse(depEntry.dependencies as string || '[]');
        for (const td of transitive) {
          const tdName = typeof td === 'string' ? td : td.name;
          if (!visited.has(tdName)) {
            queue.push({ name: tdName, depth: current.depth + 1, via: current.name });
          }
        }
      }
    }

    return { variant: 'ok', dependencies: JSON.stringify(result) };
  },

  async validateDependencies(input, storage) {
    const suiteId = input.suite as string;

    const all = await storage.find('suite-manifests');
    const entry = all.find(s => s.id === suiteId);
    if (!entry) {
      return { variant: 'ok', valid: JSON.stringify({ valid: true }) };
    }

    const deps = JSON.parse(entry.dependencies as string || '[]');
    const errors: Array<{ dependency: string; constraint: string; actual: string; message: string }> = [];

    for (const dep of deps) {
      const depName = typeof dep === 'string' ? dep : dep.name;
      const constraint = typeof dep === 'string' ? '*' : dep.version || '*';
      const depEntry = all.find(s => s.name === depName);

      if (!depEntry) {
        errors.push({
          dependency: depName,
          constraint,
          actual: 'missing',
          message: `Suite "${depName}" is not registered`,
        });
      }
    }

    if (errors.length > 0) {
      return { variant: 'invalid', errors: JSON.stringify(errors) };
    }

    return { variant: 'ok', valid: JSON.stringify({ valid: true }) };
  },

  async crossSuiteConflicts(_input, storage) {
    const all = await storage.find('suite-manifests');

    const conceptSuiteMap = new Map<string, string[]>();
    for (const suite of all) {
      const concepts = JSON.parse(suite.concepts as string || '[]');
      for (const c of concepts) {
        const cName = typeof c === 'string' ? c : c.name;
        if (!conceptSuiteMap.has(cName)) {
          conceptSuiteMap.set(cName, []);
        }
        conceptSuiteMap.get(cName)!.push(suite.name as string);
      }
    }

    const issues: Array<{ kind: string; suiteA: string; suiteB: string; entity: string; message: string }> = [];
    for (const [concept, suites] of conceptSuiteMap) {
      if (suites.length > 1) {
        for (let i = 0; i < suites.length - 1; i++) {
          for (let j = i + 1; j < suites.length; j++) {
            issues.push({
              kind: 'duplicate-concept',
              suiteA: suites[i],
              suiteB: suites[j],
              entity: concept,
              message: `Concept "${concept}" declared in both "${suites[i]}" and "${suites[j]}"`,
            });
          }
        }
      }
    }

    if (issues.length > 0) {
      return { variant: 'conflicts', issues: JSON.stringify(issues) };
    }

    return { variant: 'ok', noConflicts: JSON.stringify({ checked: all.length }) };
  },
};
