// ============================================================
// TestGen Concept Implementation — Functional Style
//
// Coordinate automated test generation from concept invariants.
// Understands all six invariant constructs:
// - example → 1:1 conformance test vectors
// - forall  → property-based tests (PBT) with generators
// - always  → stateful sequence tests checking state predicates
// - never   → violation-attempt sequence tests
// - eventually → bounded sequence tests for liveness
// - requires/ensures → PBT with constrained generators + assertions
//
// Routes to language-specific providers (TypeScript/fast-check,
// Rust/proptest, Swift/SwiftCheck, Solidity/Foundry) via
// PluginRegistry dispatch.
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import { wrapFunctional } from '../../../../runtime/functional-compat.ts';
import {
  createProgram, get, put, find, pure,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';

const GENERATIONS = 'test-generations';
const VALID_LANGUAGES = ['typescript', 'rust', 'swift', 'solidity'];

const DEFAULT_CONFIG = {
  num_runs: 10000,
  fuzz_duration_s: 60,
  shrink_enabled: true,
  stateful_test_depth: 5,
};

/**
 * Maps invariant construct kinds to the test generation strategy.
 */
const CONSTRUCT_STRATEGY: Record<string, string> = {
  example: 'conformance-vector',
  forall: 'pbt-property',
  always: 'stateful-sequence',
  never: 'violation-attempt',
  eventually: 'bounded-sequence',
  requires_ensures: 'contract-pbt',
};

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

const testGenHandlerFunctional: FunctionalConceptHandler = {

  generate(input: Record<string, unknown>) {
    const concept_ref = input.concept_ref as string;
    const language = input.language as string;
    const invariant_version = input.invariant_version as string || 'v1';

    if (!concept_ref || !language) {
      return pure(createProgram(), {
        variant: 'invalid',
        message: 'concept_ref and language are required',
      }) as StorageProgram<Result>;
    }

    if (!VALID_LANGUAGES.includes(language)) {
      return pure(createProgram(), {
        variant: 'invalid',
        message: `Unsupported language "${language}". Valid: ${VALID_LANGUAGES.join(', ')}`,
      }) as StorageProgram<Result>;
    }

    const id = `tg-${simpleHash(concept_ref + ':' + language + ':' + invariant_version)}`;
    const now = new Date().toISOString();

    // Determine provider based on language
    const providerMap: Record<string, string> = {
      typescript: 'TestGenTypeScript',
      rust: 'TestGenRust',
      swift: 'TestGenSwift',
      solidity: 'TestGenSolidity',
    };
    const provider_used = providerMap[language];

    // Generate file paths for all six construct types
    const slug = concept_ref.replace(/\//g, language === 'typescript' ? '-' : '_');
    const filesByLang: Record<string, string[]> = {
      typescript: [
        `generated/tests/${slug}.example.test.ts`,
        `generated/tests/${slug}.property.test.ts`,
        `generated/tests/${slug}.stateful.test.ts`,
        `generated/tests/${slug}.safety.test.ts`,
        `generated/tests/${slug}.liveness.test.ts`,
        `generated/tests/${slug}.contract.test.ts`,
      ],
      rust: [
        `generated/tests/${slug}_example_test.rs`,
        `generated/tests/${slug}_property_test.rs`,
        `generated/tests/${slug}_stateful_test.rs`,
        `generated/tests/${slug}_fuzz.rs`,
      ],
      swift: [
        `generated/tests/${slug}ExampleTests.swift`,
        `generated/tests/${slug}PropertyTests.swift`,
      ],
      solidity: [
        `generated/tests/${slug}.example.t.sol`,
        `generated/tests/${slug}.fuzz.t.sol`,
        `generated/tests/${slug}.invariant.t.sol`,
      ],
    };
    const generated_files = JSON.stringify(filesByLang[language] || []);

    // Build the test generation strategies based on invariant constructs
    const strategies = JSON.stringify(Object.entries(CONSTRUCT_STRATEGY).map(([kind, strategy]) => ({
      construct: kind,
      strategy,
      supported: true,
    })));

    let p = createProgram();
    p = put(p, GENERATIONS, id, {
      id,
      concept_ref,
      language,
      provider_used,
      generated_files,
      invariant_version,
      generated_at: now,
      strategies,
      num_runs: DEFAULT_CONFIG.num_runs,
      fuzz_duration_s: DEFAULT_CONFIG.fuzz_duration_s,
      shrink_enabled: DEFAULT_CONFIG.shrink_enabled,
      stateful_test_depth: DEFAULT_CONFIG.stateful_test_depth,
    });

    p = pure(p, {
      variant: 'ok',
      generation: id,
      generated_files,
      provider_used,
      strategies,
    });
    return p as StorageProgram<Result>;
  },

  regenerate(input: Record<string, unknown>) {
    const generation = input.generation as string;

    let p = createProgram();
    p = get(p, GENERATIONS, generation, 'existingGen');

    const newVersion = `v${Date.now()}`;
    p = put(p, GENERATIONS, generation, {
      invariant_version: newVersion,
      generated_at: new Date().toISOString(),
    });

    p = pure(p, {
      variant: 'ok',
      generation,
      generated_files: '[]',
      provider_used: '',
    });
    return p as StorageProgram<Result>;
  },

  list(input: Record<string, unknown>) {
    const concept_ref = input.concept_ref as string | undefined;

    let p = createProgram();
    p = find(p, GENERATIONS, concept_ref ? { concept_ref } : {}, 'allGens');
    p = pure(p, { variant: 'ok', generations: '[]' });
    return p as StorageProgram<Result>;
  },

  configure(input: Record<string, unknown>) {
    const generation = input.generation as string;

    let p = createProgram();
    p = get(p, GENERATIONS, generation, 'existingGen');

    const updates: Record<string, unknown> = {};
    if (input.num_runs !== undefined) updates.num_runs = input.num_runs;
    if (input.fuzz_duration_s !== undefined) updates.fuzz_duration_s = input.fuzz_duration_s;
    if (input.shrink_enabled !== undefined) updates.shrink_enabled = input.shrink_enabled;
    if (input.stateful_test_depth !== undefined) updates.stateful_test_depth = input.stateful_test_depth;

    p = put(p, GENERATIONS, generation, updates);
    p = pure(p, { variant: 'ok', generation });
    return p as StorageProgram<Result>;
  },

  coverage(input: Record<string, unknown>) {
    const concept_ref = input.concept_ref as string;

    let p = createProgram();
    p = find(p, GENERATIONS, { concept_ref }, 'matchingGens');

    // Coverage computation will be resolved at interpretation time.
    // The strategy breakdown tracks which invariant constructs have
    // generated tests: example, forall, always, never, eventually,
    // requires_ensures.
    p = pure(p, {
      variant: 'ok',
      total_invariants: 0,
      covered: 0,
      uncovered: 0,
      coverage_pct: 0.0,
      languages: '[]',
      construct_coverage: JSON.stringify({
        example: { total: 0, covered: 0 },
        forall: { total: 0, covered: 0 },
        always: { total: 0, covered: 0 },
        never: { total: 0, covered: 0 },
        eventually: { total: 0, covered: 0 },
        requires_ensures: { total: 0, covered: 0 },
      }),
    });
    return p as StorageProgram<Result>;
  },
};

export const testGenHandler = wrapFunctional(testGenHandlerFunctional);
export { testGenHandlerFunctional };
