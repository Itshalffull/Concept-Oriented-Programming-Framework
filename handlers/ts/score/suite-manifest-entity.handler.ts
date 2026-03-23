// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// SuiteManifestEntity Concept Implementation
//
// Queryable representation of parsed suite manifests (suite.yaml).
// Covers concept lists, sync declarations, type parameter alignment,
// dependencies, and versioning. Enables cross-suite dependency
// analysis and composition queries.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, merge, branch, complete, completeFrom,
  mapBindings, putFrom, mergeFrom, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _handler: FunctionalConceptHandler = {

  register(input: Record<string, unknown>) {
    if (!input.name || (typeof input.name === 'string' && (input.name as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }
    const name = input.name as string;
    const source = input.source as string;
    const manifest = input.manifest as string;

    const key = `suite:${name}`;

    let p = createProgram();
    p = get(p, 'suite-manifests', key, 'existing');

    return branch(p, 'existing',
      (thenP) => completeFrom(thenP, 'alreadyRegistered', (bindings) => ({
        existing: (bindings.existing as Record<string, unknown>).id,
      })),
      (elseP) => {
        const id = crypto.randomUUID();
        const parsed = manifest ? JSON.parse(manifest) : {};

        elseP = put(elseP, 'suite-manifests', key, {
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

        return complete(elseP, 'ok', { suite: id });
      },
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const name = input.name as string;

    let p = createProgram();
    p = get(p, 'suite-manifests', `suite:${name}`, 'entry');

    return branch(p, 'entry',
      (thenP) => completeFrom(thenP, 'ok', (bindings) => ({
        suite: (bindings.entry as Record<string, unknown>).id,
      })),
      (elseP) => complete(elseP, 'notfound', {}),
    ) as StorageProgram<Result>;
  },

  listAll(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'suite-manifests', {}, 'all');

    return completeFrom(p, 'ok', (bindings) => {
      const all = bindings.all as Record<string, unknown>[];
      const suites = all.map(s => ({
        name: s.name,
        version: s.version,
        conceptCount: JSON.parse(s.concepts as string || '[]').length,
        syncCount: JSON.parse(s.syncs as string || '[]').length,
      }));
      return { suites: JSON.stringify(suites) };
    }) as StorageProgram<Result>;
  },

  findByConcept(input: Record<string, unknown>) {
    if (!input.concept || (typeof input.concept === 'string' && (input.concept as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'concept is required' }) as StorageProgram<Result>;
    }
    const concept = input.concept as string;

    let p = createProgram();
    p = find(p, 'suite-manifests', {}, 'all');

    return completeFrom(p, 'ok', (bindings) => {
      const all = bindings.all as Record<string, unknown>[];
      const matched = all.filter(s => {
        const concepts = JSON.parse(s.concepts as string || '[]');
        return concepts.some((c: { name: string } | string) =>
          (typeof c === 'string' ? c : c.name) === concept
        );
      });
      return { suites: JSON.stringify(matched) };
    }) as StorageProgram<Result>;
  },

  findBySync(input: Record<string, unknown>) {
    if (!input.sync || (typeof input.sync === 'string' && (input.sync as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'sync is required' }) as StorageProgram<Result>;
    }
    const sync = input.sync as string;

    let p = createProgram();
    p = find(p, 'suite-manifests', {}, 'all');

    return completeFrom(p, 'ok', (bindings) => {
      const all = bindings.all as Record<string, unknown>[];
      const matched = all.filter(s => {
        const syncs = JSON.parse(s.syncs as string || '[]');
        return syncs.some((sy: { name: string } | string) =>
          (typeof sy === 'string' ? sy : sy.name) === sync
        );
      });
      return { suites: JSON.stringify(matched) };
    }) as StorageProgram<Result>;
  },

  concepts(input: Record<string, unknown>) {
    const suiteId = input.suite as string;

    let p = createProgram();
    p = find(p, 'suite-manifests', {}, 'all');
    p = mapBindings(p, (bindings) => {
      const all = bindings.all as Record<string, unknown>[];
      return all.find(s => s.id === suiteId) || null;
    }, '_entry');

    return branch(p,
      (bindings) => !bindings._entry,
      (thenP) => complete(thenP, 'error', { message: `suite not found: ${suiteId}` }),
      (elseP) => completeFrom(elseP, 'ok', (bindings) => ({
        concepts: (bindings._entry as Record<string, unknown>).concepts as string || '[]',
      })),
    ) as StorageProgram<Result>;
  },

  syncs(input: Record<string, unknown>) {
    const suiteId = input.suite as string;

    let p = createProgram();
    p = find(p, 'suite-manifests', {}, 'all');
    p = mapBindings(p, (bindings) => {
      const all = bindings.all as Record<string, unknown>[];
      return all.find(s => s.id === suiteId) || null;
    }, '_entry');

    return branch(p,
      (bindings) => !bindings._entry,
      (thenP) => complete(thenP, 'error', { message: `suite not found: ${suiteId}` }),
      (elseP) => completeFrom(elseP, 'ok', (bindings) => ({
        syncs: (bindings._entry as Record<string, unknown>).syncs as string || '[]',
      })),
    ) as StorageProgram<Result>;
  },

  dependencyGraph(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'suite-manifests', {}, 'all');

    return completeFrom(p, 'ok', (bindings) => {
      const all = bindings.all as Record<string, unknown>[];

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

      return { graph: JSON.stringify({ nodes, edges }) };
    }) as StorageProgram<Result>;
  },

  transitiveDependencies(input: Record<string, unknown>) {
    const suiteId = input.suite as string;

    let p = createProgram();
    p = find(p, 'suite-manifests', {}, 'all');
    p = mapBindings(p, (bindings) => {
      const all = bindings.all as Record<string, unknown>[];
      return all.find(s => s.id === suiteId) || null;
    }, '_entry');

    return branch(p,
      (bindings) => !bindings._entry,
      (thenP) => complete(thenP, 'error', { message: `suite not found: ${suiteId}` }),
      (elseP) => completeFrom(elseP, 'ok', (bindings) => {
        const all = bindings.all as Record<string, unknown>[];
        const entry = bindings._entry as Record<string, unknown>;
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
          const depEntry = all.find(s => (s as any).name === current.name);
          result.push({
            name: current.name,
            version: (depEntry?.version as string) || 'unknown',
            depth: current.depth,
            via: current.via,
          });
          if (depEntry) {
            const transitive = JSON.parse((depEntry as any).dependencies as string || '[]');
            for (const td of transitive) {
              const tdName = typeof td === 'string' ? td : td.name;
              if (!visited.has(tdName)) {
                queue.push({ name: tdName, depth: current.depth + 1, via: current.name });
              }
            }
          }
        }

        return { dependencies: JSON.stringify(result) };
      }),
    ) as StorageProgram<Result>;
  },

  validateDependencies(input: Record<string, unknown>) {
    const suiteId = input.suite as string;

    let p = createProgram();
    p = find(p, 'suite-manifests', {}, 'all');
    // Find the target suite by ID or by looking up as a name key
    p = mapBindings(p, (bindings) => {
      const all = bindings.all as Record<string, unknown>[];
      return all.find(s => s.id === suiteId || (s as any)._key === `suite:${suiteId}`) || null;
    }, '_entry');
    // Also track whether any suites exist at all
    p = mapBindings(p, (bindings) => {
      const all = bindings.all as Record<string, unknown>[];
      return all.length > 0;
    }, '_hasSuites');

    return branch(p,
      (bindings) => !bindings._entry && !bindings._hasSuites,
      (thenP) => complete(thenP, 'error', { message: `suite not found: ${suiteId}` }),
      (elseP) => {
        // If entry not found but other suites exist, or entry found — validate
        elseP = mapBindings(elseP, (bindings) => {
          const all = bindings.all as Record<string, unknown>[];
          const entry = bindings._entry as Record<string, unknown> | null;
          if (!entry) return [];
          const deps = JSON.parse(entry.dependencies as string || '[]');
          const errors: Array<{ dependency: string; constraint: string; actual: string; message: string }> = [];
          for (const dep of deps) {
            const depName = typeof dep === 'string' ? dep : dep.name;
            const constraint = typeof dep === 'string' ? '*' : dep.version || '*';
            const depEntry = all.find(s => (s as any).name === depName);
            if (!depEntry) {
              errors.push({ dependency: depName, constraint, actual: 'missing', message: `Suite "${depName}" is not registered` });
            }
          }
          return errors;
        }, '_errors');
        return branch(elseP,
          (bindings) => (bindings._errors as unknown[]).length > 0,
          (invalidP) => completeFrom(invalidP, 'invalid', (bindings) => ({
            errors: JSON.stringify(bindings._errors),
          })),
          (okP) => complete(okP, 'ok', { valid: JSON.stringify({ valid: true }) }),
        );
      },
    ) as StorageProgram<Result>;
  },

  crossSuiteConflicts(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'suite-manifests', {}, 'all');

    return completeFrom(p, 'ok', (bindings) => {
      const all = bindings.all as Record<string, unknown>[];

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

      return { noConflicts: JSON.stringify({ checked: all.length }) };
    }) as StorageProgram<Result>;
  },
};

export const suiteManifestEntityHandler = autoInterpret(_handler);
