// SolverProvider Concept Implementation — Formal Verification Suite
// Register, dispatch to, health-check, and manage external solver backends
// (SMT solvers, model checkers, proof assistants) as pluggable providers.
// See Architecture doc Section 18.5
import type { ConceptHandler, ConceptStorage } from '../../../../runtime/types.js';

const RELATION = 'solver-providers';

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return 'sha256-' + Math.abs(hash).toString(16).padStart(12, '0');
}

export const solverProviderHandler: ConceptHandler = {
  async register(input, storage) {
    const provider_id = input.provider_id as string;
    const name = input.name as string;
    const supported_languages = input.supported_languages as string;  // JSON array
    const supported_kinds = input.supported_kinds as string;          // JSON array
    const endpoint = input.endpoint as string | undefined;
    const priority = input.priority as number | undefined;

    if (!provider_id || !name) {
      return { variant: 'invalid', message: 'provider_id and name are required' };
    }

    let languages: string[];
    let kinds: string[];
    try {
      languages = JSON.parse(supported_languages);
      kinds = JSON.parse(supported_kinds);
    } catch {
      return { variant: 'invalid', message: 'supported_languages and supported_kinds must be valid JSON arrays' };
    }

    // Check for duplicate provider_id
    const existing = await storage.find(RELATION);
    const duplicate = existing.find((p: any) => p.provider_id === provider_id);
    if (duplicate) {
      return { variant: 'duplicate', provider_id, message: `Provider "${provider_id}" is already registered` };
    }

    const id = `sp-${simpleHash(provider_id + ':' + name)}`;
    const now = new Date().toISOString();

    await storage.put(RELATION, id, {
      id,
      provider_id,
      name,
      supported_languages: JSON.stringify(languages),
      supported_kinds: JSON.stringify(kinds),
      endpoint: endpoint || '',
      priority: priority ?? 100,
      status: 'active',
      registered_at: now,
    });

    return { variant: 'ok', id, provider_id, name, status: 'active' };
  },

  async dispatch(input, storage) {
    const formal_language = input.formal_language as string;
    const kind = input.kind as string;
    const property_ref = input.property_ref as string;

    const all = await storage.find(RELATION);

    // Find providers matching both formal_language and kind
    const matching = all.filter((p: any) => {
      if (p.status !== 'active') return false;
      const languages: string[] = JSON.parse(p.supported_languages as string);
      const kinds: string[] = JSON.parse(p.supported_kinds as string);
      return languages.includes(formal_language) && kinds.includes(kind);
    });

    if (matching.length === 0) {
      return {
        variant: 'no_provider',
        formal_language,
        kind,
        message: `No active provider found for language="${formal_language}", kind="${kind}"`,
      };
    }

    // Select the provider with the lowest priority value (highest precedence)
    matching.sort((a: any, b: any) => (a.priority as number) - (b.priority as number));
    const selected = matching[0];

    // Create a mock run reference
    const run_ref = `run-${simpleHash(property_ref + ':' + selected.provider_id + ':' + Date.now().toString())}`;

    return {
      variant: 'ok',
      provider_id: selected.provider_id as string,
      provider_name: selected.name as string,
      run_ref,
      property_ref,
    };
  },

  async dispatch_batch(input, storage) {
    const property_refs = input.property_refs as string;  // JSON array of property ref strings

    let refs: string[];
    try {
      refs = JSON.parse(property_refs);
    } catch {
      return { variant: 'invalid', message: 'property_refs must be a valid JSON array' };
    }

    if (!Array.isArray(refs) || refs.length === 0) {
      return { variant: 'invalid', message: 'property_refs must be a non-empty array' };
    }

    const allProviders = await storage.find(RELATION);
    const activeProviders = allProviders.filter((p: any) => p.status === 'active');

    // Group properties by language+kind (mock: use property_ref prefix or defaults)
    // In a real implementation, we would look up property metadata from FormalProperty storage.
    const assignments: Array<{ property_ref: string; provider_id: string; run_ref: string }> = [];
    const unassigned: string[] = [];

    for (const ref of refs) {
      // Mock: derive language and kind from the property ref hash for grouping,
      // or use defaults. Real implementation looks up property metadata.
      const defaultLanguage = 'smtlib';
      const defaultKind = 'invariant';

      const matching = activeProviders.filter((p: any) => {
        const languages: string[] = JSON.parse(p.supported_languages as string);
        const kinds: string[] = JSON.parse(p.supported_kinds as string);
        return languages.includes(defaultLanguage) && kinds.includes(defaultKind);
      });

      if (matching.length > 0) {
        matching.sort((a: any, b: any) => (a.priority as number) - (b.priority as number));
        const selected = matching[0];
        const run_ref = `run-${simpleHash(ref + ':' + selected.provider_id + ':batch')}`;
        assignments.push({
          property_ref: ref,
          provider_id: selected.provider_id as string,
          run_ref,
        });
      } else {
        unassigned.push(ref);
      }
    }

    return {
      variant: 'ok',
      assignments: JSON.stringify(assignments),
      assigned_count: assignments.length,
      unassigned: JSON.stringify(unassigned),
      unassigned_count: unassigned.length,
    };
  },

  async health_check(input, storage) {
    const provider_id = input.provider_id as string;

    const all = await storage.find(RELATION);
    const provider = all.find((p: any) => p.provider_id === provider_id);

    if (!provider) {
      return { variant: 'notfound', provider_id };
    }

    // Mock health check: simulate latency and status
    const mockLatencyMs = Math.abs(simpleHash(provider_id + Date.now().toString()).charCodeAt(8) % 200) + 10;
    const status = provider.status as string;

    return {
      variant: 'ok',
      provider_id,
      name: provider.name as string,
      status,
      latency_ms: mockLatencyMs,
      endpoint: provider.endpoint as string,
    };
  },

  async list(input, storage) {
    const all = await storage.find(RELATION);

    const items = all.map((p: any) => ({
      id: p.id,
      provider_id: p.provider_id,
      name: p.name,
      supported_languages: p.supported_languages,
      supported_kinds: p.supported_kinds,
      priority: p.priority,
      status: p.status,
    }));

    return { variant: 'ok', items: JSON.stringify(items), count: items.length };
  },

  async unregister(input, storage) {
    const provider_id = input.provider_id as string;

    const all = await storage.find(RELATION);
    const provider = all.find((p: any) => p.provider_id === provider_id);

    if (!provider) {
      return { variant: 'notfound', provider_id };
    }

    await storage.del(RELATION, provider.id as string);

    return { variant: 'ok', provider_id, name: provider.name as string };
  },
};
