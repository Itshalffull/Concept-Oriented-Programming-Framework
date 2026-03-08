// ============================================================
// SolverProvider Handler — Formal Verification Suite
//
// Register, dispatch to, health-check, and manage external
// solver backends (SMT solvers, model checkers, proof assistants)
// as pluggable providers.
// See Architecture doc Section 18.5
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../../runtime/types.js';
import { randomUUID } from 'crypto';

const COLLECTION = 'solver-providers';
const DISPATCH_LOG = 'solver-dispatch-log';

export const solverProviderHandler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    const provider_id = input.provider_id as string;
    const name = input.name as string;
    const supported_languages = input.supported_languages as string;
    const supported_kinds = input.supported_kinds as string;
    const endpoint = input.endpoint as string;
    const priority = input.priority as number;

    // Check for duplicate
    const existing = await storage.get(COLLECTION, provider_id);
    if (existing) {
      return { variant: 'duplicate', provider_id };
    }

    const created_at = new Date().toISOString();

    await storage.put(COLLECTION, provider_id, {
      provider_id,
      name,
      supported_languages,
      supported_kinds,
      endpoint,
      priority,
      status: 'active',
      created_at,
    });

    return {
      variant: 'ok',
      provider_id,
      name,
      status: 'active',
    };
  },

  async dispatch(input: Record<string, unknown>, storage: ConceptStorage) {
    const formal_language = input.formal_language as string;
    const kind = input.kind as string;
    const property_ref = input.property_ref as string;

    const all = await storage.find(COLLECTION);

    // Filter providers that support both the language and kind
    const candidates = all.filter(p => {
      const langs = JSON.parse(p.supported_languages as string) as string[];
      const kinds = JSON.parse(p.supported_kinds as string) as string[];
      return langs.includes(formal_language) && kinds.includes(kind);
    });

    if (candidates.length === 0) {
      return { variant: 'no_provider', formal_language, kind };
    }

    // Select provider with lowest priority number (highest priority)
    candidates.sort((a, b) => (a.priority as number) - (b.priority as number));
    const selected = candidates[0];

    const run_ref = `run-${randomUUID()}`;

    return {
      variant: 'ok',
      provider_id: selected.provider_id,
      property_ref,
      run_ref,
    };
  },

  async dispatch_batch(input: Record<string, unknown>, storage: ConceptStorage) {
    const property_refs = JSON.parse(input.property_refs as string) as string[];

    const all = await storage.find(COLLECTION);

    const assignments: Array<{ property_ref: string; provider_id: string; run_ref: string }> = [];
    const unassigned: string[] = [];

    for (const property_ref of property_refs) {
      // For batch dispatch, find any available provider
      // Default to smtlib + invariant as the common case
      const candidates = all.filter(p => {
        return (p.status as string) === 'active';
      });

      if (candidates.length === 0) {
        unassigned.push(property_ref);
        continue;
      }

      // Select provider with lowest priority
      candidates.sort((a, b) => (a.priority as number) - (b.priority as number));
      const selected = candidates[0];

      assignments.push({
        property_ref,
        provider_id: selected.provider_id as string,
        run_ref: `run-${randomUUID()}`,
      });
    }

    return {
      variant: 'ok',
      assigned_count: assignments.length,
      unassigned_count: unassigned.length,
      assignments: JSON.stringify(assignments),
      unassigned: JSON.stringify(unassigned),
    };
  },

  async health_check(input: Record<string, unknown>, storage: ConceptStorage) {
    const provider_id = input.provider_id as string;

    const provider = await storage.get(COLLECTION, provider_id);
    if (!provider) {
      return { variant: 'notfound', provider_id };
    }

    // Simulate latency measurement
    const latency_ms = Math.floor(Math.random() * 50) + 5;

    return {
      variant: 'ok',
      provider_id,
      name: provider.name,
      status: provider.status,
      latency_ms,
    };
  },

  async list(input: Record<string, unknown>, storage: ConceptStorage) {
    const all = await storage.find(COLLECTION);

    return {
      variant: 'ok',
      count: all.length,
      items: JSON.stringify(
        all.map(p => ({
          provider_id: p.provider_id,
          name: p.name,
          status: p.status,
          endpoint: p.endpoint,
          priority: p.priority,
        })),
      ),
    };
  },

  async unregister(input: Record<string, unknown>, storage: ConceptStorage) {
    const provider_id = input.provider_id as string;

    const provider = await storage.get(COLLECTION, provider_id);
    if (!provider) {
      return { variant: 'notfound', provider_id };
    }

    await storage.del(COLLECTION, provider_id);

    return {
      variant: 'ok',
      provider_id,
    };
  },
};
