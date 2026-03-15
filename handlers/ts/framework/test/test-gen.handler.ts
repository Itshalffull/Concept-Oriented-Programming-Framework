// ============================================================
// TestGen Concept Implementation
//
// Coordinate automated test generation from concept invariants.
// Routes to language-specific providers (TypeScript/fast-check,
// Rust/proptest, Swift/SwiftCheck, Solidity/Foundry) via
// PluginRegistry dispatch.
// See Architecture doc Section 7
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../../runtime/types.js';

const GENERATIONS = 'test-generations';

const VALID_LANGUAGES = ['typescript', 'rust', 'swift', 'solidity'];

const DEFAULT_CONFIG = {
  num_runs: 10000,
  fuzz_duration_s: 60,
  shrink_enabled: true,
  stateful_test_depth: 5,
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

export const testGenHandler: ConceptHandler = {

  async generate(input, storage) {
    const concept_ref = input.concept_ref as string;
    const language = input.language as string;
    const invariant_version = input.invariant_version as string;

    if (!concept_ref || !language) {
      return { variant: 'invalid', message: 'concept_ref and language are required' };
    }

    if (!VALID_LANGUAGES.includes(language)) {
      return {
        variant: 'invalid',
        message: `Unsupported language "${language}". Valid: ${VALID_LANGUAGES.join(', ')}`,
      };
    }

    const id = `tg-${simpleHash(concept_ref + ':' + language + ':' + (invariant_version || 'v1'))}`;
    const now = new Date().toISOString();

    // Determine provider based on language
    const providerMap: Record<string, string> = {
      typescript: 'TestGenTypeScript',
      rust: 'TestGenRust',
      swift: 'TestGenSwift',
      solidity: 'TestGenSolidity',
    };
    const provider_used = providerMap[language];

    // Generate file paths based on language conventions
    const filePathMap: Record<string, string[]> = {
      typescript: [
        `generated/tests/${concept_ref.replace(/\//g, '-')}.property.test.ts`,
        `generated/tests/${concept_ref.replace(/\//g, '-')}.stateful.test.ts`,
      ],
      rust: [
        `generated/tests/${concept_ref.replace(/\//g, '_')}_property_test.rs`,
        `generated/tests/${concept_ref.replace(/\//g, '_')}_fuzz.rs`,
      ],
      swift: [
        `generated/tests/${concept_ref.replace(/\//g, '_')}PropertyTests.swift`,
      ],
      solidity: [
        `generated/tests/${concept_ref.replace(/\//g, '_')}.fuzz.t.sol`,
        `generated/tests/${concept_ref.replace(/\//g, '_')}.invariant.t.sol`,
      ],
    };
    const generated_files = JSON.stringify(filePathMap[language] || []);

    await storage.put(GENERATIONS, id, {
      id,
      concept_ref,
      language,
      provider_used,
      generated_files,
      invariant_version: invariant_version || 'v1',
      generated_at: now,
      num_runs: DEFAULT_CONFIG.num_runs,
      fuzz_duration_s: DEFAULT_CONFIG.fuzz_duration_s,
      shrink_enabled: DEFAULT_CONFIG.shrink_enabled,
      stateful_test_depth: DEFAULT_CONFIG.stateful_test_depth,
    });

    return { variant: 'ok', generation: id, generated_files, provider_used };
  },

  async regenerate(input, storage) {
    const generation = input.generation as string;

    const all = await storage.find(GENERATIONS);
    const existing = all.find((g: any) => g.id === generation);

    if (!existing) {
      return { variant: 'notfound', generation };
    }

    const now = new Date().toISOString();
    const concept_ref = existing.concept_ref as string;
    const language = existing.language as string;

    // Re-generate with current invariant version (bumped)
    const newVersion = `v${Date.now()}`;

    const filePathMap: Record<string, string[]> = {
      typescript: [
        `generated/tests/${concept_ref.replace(/\//g, '-')}.property.test.ts`,
        `generated/tests/${concept_ref.replace(/\//g, '-')}.stateful.test.ts`,
      ],
      rust: [
        `generated/tests/${concept_ref.replace(/\//g, '_')}_property_test.rs`,
        `generated/tests/${concept_ref.replace(/\//g, '_')}_fuzz.rs`,
      ],
      swift: [
        `generated/tests/${concept_ref.replace(/\//g, '_')}PropertyTests.swift`,
      ],
      solidity: [
        `generated/tests/${concept_ref.replace(/\//g, '_')}.fuzz.t.sol`,
        `generated/tests/${concept_ref.replace(/\//g, '_')}.invariant.t.sol`,
      ],
    };
    const generated_files = JSON.stringify(filePathMap[language] || []);

    await storage.put(GENERATIONS, generation, {
      ...existing,
      generated_files,
      invariant_version: newVersion,
      generated_at: now,
    });

    return {
      variant: 'ok',
      generation,
      generated_files,
      provider_used: existing.provider_used as string,
    };
  },

  async list(input, storage) {
    const concept_ref = input.concept_ref as string | undefined;
    const language = input.language as string | undefined;

    const all = await storage.find(GENERATIONS);

    let filtered = all;
    if (concept_ref) {
      filtered = filtered.filter((g: any) => g.concept_ref === concept_ref);
    }
    if (language) {
      filtered = filtered.filter((g: any) => g.language === language);
    }

    const ids = filtered.map((g: any) => g.id as string);
    return { variant: 'ok', generations: JSON.stringify(ids) };
  },

  async configure(input, storage) {
    const generation = input.generation as string;

    const all = await storage.find(GENERATIONS);
    const existing = all.find((g: any) => g.id === generation);

    if (!existing) {
      return { variant: 'notfound', generation };
    }

    const updates: Record<string, any> = { ...existing };
    if (input.num_runs !== undefined) updates.num_runs = input.num_runs;
    if (input.fuzz_duration_s !== undefined) updates.fuzz_duration_s = input.fuzz_duration_s;
    if (input.shrink_enabled !== undefined) updates.shrink_enabled = input.shrink_enabled;
    if (input.stateful_test_depth !== undefined) updates.stateful_test_depth = input.stateful_test_depth;

    await storage.put(GENERATIONS, generation, updates);

    return { variant: 'ok', generation };
  },

  async coverage(input, storage) {
    const concept_ref = input.concept_ref as string;

    const all = await storage.find(GENERATIONS);
    const matching = all.filter((g: any) => g.concept_ref === concept_ref);

    if (matching.length === 0) {
      return {
        variant: 'ok',
        total_invariants: 0,
        covered: 0,
        uncovered: 0,
        coverage_pct: 0.0,
        languages: JSON.stringify([]),
      };
    }

    // Aggregate coverage across languages
    const languages = [...new Set(matching.map((g: any) => g.language as string))];

    // Mock invariant count based on generation records
    // Real implementation parses the concept spec to count invariant clauses
    const total_invariants = matching.length * 3; // approximate 3 invariants per generation
    const covered = total_invariants;
    const coverage_pct = total_invariants > 0 ? (covered / total_invariants) * 100.0 : 0.0;

    return {
      variant: 'ok',
      total_invariants,
      covered,
      uncovered: total_invariants - covered,
      coverage_pct,
      languages: JSON.stringify(languages),
    };
  },
};
