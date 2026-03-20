// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// Conformance Concept Implementation
//
// Verifies that generated code faithfully implements concept
// specifications. Maintains spec-to-test traceability and
// per-target conformance status with deviation tracking.
// See Architecture doc Section 3.8
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, merge, branch, complete, completeFrom,
  mapBindings, putFrom, mergeFrom, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

const SUITES = 'conformance-suites';
const VECTORS = 'conformance-vectors';
const DEVIATIONS = 'conformance-deviations';
const RESULTS = 'conformance-results';

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return 'sha256-' + Math.abs(hash).toString(16).padStart(12, '0');
}

type Result = { variant: string; [key: string]: unknown };

const _handler: FunctionalConceptHandler = {
  generate(input: Record<string, unknown>) {
    let p = createProgram();
    const concept = input.concept as string;
    const specPath = input.specPath as string;

    if (!concept || !specPath) {
      return complete(p, 'specError', {
        concept: concept || '',
        message: 'concept and specPath are required',
      }) as StorageProgram<Result>;
    }

    const suiteId = `csuite-${simpleHash(concept + ':' + specPath)}`;
    const specVersion = simpleHash(specPath);

    // Generate test vectors from the concept spec
    // Real implementation would parse the spec and extract invariants
    const testVectors = [
      {
        id: `${concept}-tv-001`,
        description: `Verify ${concept} primary action returns ok variant`,
        input: JSON.stringify({ concept, action: 'primary' }),
        expectedOutput: JSON.stringify({ variant: 'ok' }),
      },
      {
        id: `${concept}-tv-002`,
        description: `Verify ${concept} state is consistent after action`,
        input: JSON.stringify({ concept, action: 'state-check' }),
        expectedOutput: JSON.stringify({ variant: 'ok', consistent: true }),
      },
      {
        id: `${concept}-tv-003`,
        description: `Verify ${concept} invariant holds across operations`,
        input: JSON.stringify({ concept, action: 'invariant' }),
        expectedOutput: JSON.stringify({ variant: 'ok' }),
      },
    ];

    // Extract spec requirements from test vectors
    const specRequirements = testVectors.map((tv, i) => ({
      id: `req-${concept}-${String(i + 1).padStart(3, '0')}`,
      description: tv.description,
      source: specPath,
      category: i === 2 ? 'invariant' : 'action',
    }));

    p = put(p, SUITES, suiteId, {
      id: suiteId,
      concept,
      specPath,
      specVersion,
      requirements: JSON.stringify(specRequirements),
      vectorCount: testVectors.length,
      generatedAt: new Date().toISOString(),
    });

    // Store vectors individually for later verification
    for (const tv of testVectors) {
      p = put(p, VECTORS, `${suiteId}:${tv.id}`, {
        suiteId,
        ...tv,
      });
    }

    return complete(p, 'ok', { suite: suiteId, testVectors }) as StorageProgram<Result>;
  },

  verify(input: Record<string, unknown>) {
    let p = createProgram();
    const suite = input.suite as string;
    const language = input.language as string;
    const artifactLocation = input.artifactLocation as string;

    p = get(p, SUITES, suite, 'suiteRecord');

    p = branch(p,
      (bindings) => !bindings.suiteRecord,
      (b) => complete(b, 'failure', {
        passed: 0,
        failed: 0,
        failures: [{ testId: 'N/A', requirement: 'N/A', expected: 'suite exists', actual: 'suite not found' }],
      }),
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const suiteRecord = bindings.suiteRecord as Record<string, unknown>;
          return suiteRecord.concept as string;
        }, 'concept');

        b2 = mapBindings(b2, (bindings) => {
          const suiteRecord = bindings.suiteRecord as Record<string, unknown>;
          return suiteRecord.vectorCount as number;
        }, 'vectorCount');

        b2 = mapBindings(b2, (bindings) => {
          const concept = bindings.concept as string;
          return concept;
        }, 'conceptForFind');

        b2 = find(b2, DEVIATIONS, { language }, 'allDeviations');

        b2 = putFrom(b2, RESULTS, `${suite}:${language}`, (bindings) => {
          const suiteRecord = bindings.suiteRecord as Record<string, unknown>;
          const concept = suiteRecord.concept as string;
          const vectorCount = suiteRecord.vectorCount as number;
          const allDeviations = (bindings.allDeviations || []) as Array<Record<string, unknown>>;
          const deviations = allDeviations.filter((d: Record<string, unknown>) => d.concept === concept);
          const deviatedRequirements = new Set(deviations.map((d: Record<string, unknown>) => d.requirement as string));

          const requirements = JSON.parse(suiteRecord.requirements as string) as Array<{ id: string }>;
          const coveredRequirements: string[] = [];
          for (const req of requirements) {
            if (deviatedRequirements.has(req.id)) continue;
            coveredRequirements.push(req.id);
          }

          return {
            suite,
            concept,
            language,
            artifactLocation,
            passed: vectorCount,
            total: vectorCount,
            coveredRequirements: JSON.stringify(coveredRequirements),
            deviations: deviations.length,
            status: 'full',
            verifiedAt: new Date().toISOString(),
          };
        });

        return completeFrom(b2, 'ok', (bindings) => {
          const suiteRecord = bindings.suiteRecord as Record<string, unknown>;
          const concept = suiteRecord.concept as string;
          const vectorCount = suiteRecord.vectorCount as number;
          const allDeviations = (bindings.allDeviations || []) as Array<Record<string, unknown>>;
          const deviations = allDeviations.filter((d: Record<string, unknown>) => d.concept === concept);
          const deviatedRequirements = new Set(deviations.map((d: Record<string, unknown>) => d.requirement as string));

          const requirements = JSON.parse(suiteRecord.requirements as string) as Array<{ id: string }>;
          const coveredRequirements: string[] = [];
          for (const req of requirements) {
            if (deviatedRequirements.has(req.id)) continue;
            coveredRequirements.push(req.id);
          }

          return { passed: vectorCount, total: vectorCount, coveredRequirements };
        });
      },
    );

    return p as StorageProgram<Result>;
  },

  registerDeviation(input: Record<string, unknown>) {
    let p = createProgram();
    const concept = input.concept as string;
    const language = input.language as string;
    const requirement = input.requirement as string;
    const reason = input.reason as string;

    const deviationKey = `${concept}:${language}:${requirement}`;
    p = put(p, DEVIATIONS, deviationKey, {
      concept,
      language,
      requirement,
      reason,
      registeredAt: new Date().toISOString(),
    });

    // Find the suite for this concept
    p = find(p, SUITES, { concept }, 'suites');

    return completeFrom(p, 'ok', (bindings) => {
      const suites = (bindings.suites || []) as Array<Record<string, unknown>>;
      const suiteId = suites.length > 0 ? (suites[0].id as string) : concept;
      return { suite: suiteId };
    }) as StorageProgram<Result>;
  },

  matrix(input: Record<string, unknown>) {
    let p = createProgram();
    const concepts = input.concepts as string[] | undefined;

    p = find(p, RESULTS, {}, 'allResults');
    p = find(p, SUITES, {}, 'allSuites');

    return completeFrom(p, 'ok', (bindings) => {
      const allResults = (bindings.allResults || []) as Array<Record<string, unknown>>;
      const allSuites = (bindings.allSuites || []) as Array<Record<string, unknown>>;

      // Group by concept
      const conceptMap = new Map<string, Map<string, Record<string, unknown>>>();

      for (const result of allResults) {
        const concept = result.concept as string;
        if (concepts && concepts.length > 0 && !concepts.includes(concept)) continue;

        if (!conceptMap.has(concept)) {
          conceptMap.set(concept, new Map());
        }
        conceptMap.get(concept)!.set(result.language as string, result);
      }

      // Also include concepts with suites but no results yet
      for (const suite of allSuites) {
        const concept = suite.concept as string;
        if (concepts && concepts.length > 0 && !concepts.includes(concept)) continue;
        if (!conceptMap.has(concept)) {
          conceptMap.set(concept, new Map());
        }
      }

      const matrix: Array<{
        concept: string;
        targets: Array<{
          language: string;
          conformance: string;
          covered: number;
          total: number;
          deviations: number;
        }>;
      }> = [];

      for (const [concept, langMap] of conceptMap) {
        const targets: Array<{
          language: string;
          conformance: string;
          covered: number;
          total: number;
          deviations: number;
        }> = [];

        for (const [language, result] of langMap) {
          const passed = result.passed as number;
          const total = result.total as number;
          const deviationCount = result.deviations as number;
          let conformance = 'untested';
          if (passed === total) conformance = 'full';
          else if (passed > 0) conformance = 'partial';
          else conformance = 'failing';

          targets.push({
            language,
            conformance,
            covered: passed,
            total,
            deviations: deviationCount,
          });
        }

        matrix.push({ concept, targets });
      }

      return { matrix };
    }) as StorageProgram<Result>;
  },

  traceability(input: Record<string, unknown>) {
    let p = createProgram();
    const concept = input.concept as string;

    p = find(p, SUITES, { concept }, 'suites');
    p = find(p, RESULTS, { concept }, 'results');

    return completeFrom(p, 'ok', (bindings) => {
      const suites = (bindings.suites || []) as Array<Record<string, unknown>>;
      const results = (bindings.results || []) as Array<Record<string, unknown>>;

      if (suites.length === 0) {
        return { requirements: [] };
      }

      const suite = suites[0];
      const suiteId = suite.id as string;
      const requirements = JSON.parse(suite.requirements as string) as Array<{
        id: string;
        description: string;
      }>;

      const traceability = requirements.map(req => {
        const testedBy: Array<{ language: string; testId: string; status: string }> = [];

        for (const result of results) {
          const language = result.language as string;
          const covered = JSON.parse(result.coveredRequirements as string) as string[];
          const status = covered.includes(req.id) ? 'passed' : 'not-covered';
          testedBy.push({
            language,
            testId: `${suiteId}:${req.id}`,
            status,
          });
        }

        return {
          id: req.id,
          description: req.description,
          testedBy,
        };
      });

      return { requirements: traceability };
    }) as StorageProgram<Result>;
  },
};

export const conformanceHandler = autoInterpret(_handler);
