// @clef-handler style=functional
// StatusGate Concept Handler — Functional Style
// Reports verification status to external gates (CI checks, webhooks, etc.).
// Uses perform("http", "POST", ...) for all provider HTTP calls, routing
// through the execution layer: ExternalCall → HttpProvider → endpoint.
//
// Default provider: "exit-code" (works in any CI with zero config).

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, find, branch, perform, completeFrom,
  type StorageProgram,
  complete,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

// ── Handler ──────────────────────────────────────────────────────────

const _statusGateHandler: FunctionalConceptHandler = {

  report(input: Record<string, unknown>) {
    if (!input.target || (typeof input.target === 'string' && (input.target as string).trim() === '')) {
      return complete(createProgram(), 'provider_error', { message: 'target is required' }) as StorageProgram<Result>;
    }
    const id = `gate-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    const providerName = (input.provider as string) || 'exit-code';
    const target = input.target as string;
    const context = (input.context as string) || 'clef/verify';
    const status = (input.status as string) || 'pending';
    const details = (input.details as string) || '';
    const url = (input.url as string) || '';

    let p = createProgram();

    // Persist gate
    p = put(p, 'gates', id, {
      id, target, context, status, details,
      provider: providerName, url,
      completed: false,
      reported_at: now,
      updated_at: null,
    });

    // Dispatch to external provider via perform() — the execution layer
    // routes this through ExternalCall → HttpProvider → configured endpoint
    if (providerName === 'github') {
      const stateMap: Record<string, string> = {
        pending: 'pending', passing: 'success', failing: 'failure', error: 'error',
      };
      p = perform(p, 'http', 'POST', {
        endpoint: 'github-api',
        path: `/statuses/${target}`,
        body: JSON.stringify({
          state: stateMap[status] ?? 'pending',
          context,
          description: details.slice(0, 140),
          target_url: url || undefined,
        }),
      }, 'providerResponse');
    } else if (providerName === 'gitlab') {
      const stateMap: Record<string, string> = {
        pending: 'pending', passing: 'success', failing: 'failed', error: 'failed',
      };
      const params = new URLSearchParams({
        state: stateMap[status] ?? 'pending',
        name: context,
        description: details.slice(0, 140),
      });
      if (url) params.set('target_url', url);
      p = perform(p, 'http', 'POST', {
        endpoint: 'gitlab-api',
        path: `/statuses/${target}?${params}`,
        body: '',
      }, 'providerResponse');
    } else if (providerName === 'webhook') {
      p = perform(p, 'http', 'POST', {
        endpoint: 'webhook',
        path: url,
        body: JSON.stringify({
          target, context, status, details,
          completed: false, reported_at: now,
        }),
      }, 'providerResponse');
    }
    // exit-code provider: no external call needed

    p = complete(p, 'ok', { gate: id,
      target,
      provider: providerName });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  update(input: Record<string, unknown>) {
    const gateId = input.gate as string;
    const status = input.status as string || '';
    const details = input.details as string || '';
    const now = new Date().toISOString();

    let p = createProgram();
    p = get(p, 'gates', gateId, 'gateData');
    return branch(p, 'gateData',
      (b) => {
        let b2 = put(b, 'gates', gateId, { status, details, updated_at: now });
        return complete(b2, 'ok', { gate: gateId, status });
      },
      (b) => complete(b, 'not_found', { message: `Gate "${gateId}" not found` }),
    ) as StorageProgram<Result>;
  },

  complete(input: Record<string, unknown>) {
    const gateId = input.gate as string;
    const finalStatus = (input.final_status as string) || '';
    const details = input.details as string || '';
    const now = new Date().toISOString();

    let p = createProgram();
    p = get(p, 'gates', gateId, 'gateData');
    return branch(p, 'gateData',
      (b) => {
        const accepted = finalStatus === 'passing';
        let b2 = put(b, 'gates', gateId, { status: finalStatus, details, completed: true, updated_at: now });
        return complete(b2, 'ok', { gate: gateId, accepted });
      },
      (b) => complete(b, 'not_found', { message: `Gate "${gateId}" not found` }),
    ) as StorageProgram<Result>;
  },

  configure(input: Record<string, unknown>) {
    const provider = (input.provider as string) || 'exit-code';
    const url = (input.url as string) || '';

    let p = createProgram();
    p = put(p, 'config', 'default', { provider, url });
    p = complete(p, 'ok', { provider });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  get_status(input: Record<string, unknown>) {
    const gateId = input.gate as string;

    let p = createProgram();
    p = get(p, 'gates', gateId, 'gateData');
    return branch(p, 'gateData',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const g = bindings.gateData as Record<string, unknown>;
        return { gate: gateId, target: g.target, status: g.status, provider: g.provider, details: g.details, completed: g.completed };
      }),
      (b) => complete(b, 'not_found', { message: `Gate "${gateId}" not found` }),
    ) as StorageProgram<Result>;
  },

  list(input: Record<string, unknown>) {
    if (!input.target || (typeof input.target === 'string' && (input.target as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'target is required' }) as StorageProgram<Result>;
    }
    const target = input.target as string;

    let p = createProgram();
    p = find(p, 'gates', target ? { target } : {}, 'allGates');
    p = complete(p, 'ok', { gates: '[]' });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const statusGateHandler = autoInterpret(_statusGateHandler);



// ── Utility: check if all gates for a target are passing ─────────────

/**
 * Check all gates for a target and return an exit code.
 * Used by `clef verify status --exit-code`.
 */
export async function checkGatesExitCode(storage: ConceptStorage, target?: string): Promise<number> {
  const gates = await storage.find('gates', target ? { target } : undefined);

  if (gates.length === 0) {
    return 0; // No gates = nothing to block
  }

  const failing = gates.some(g => g['status'] === 'failing' || g['status'] === 'error');
  return failing ? 1 : 0;
}
