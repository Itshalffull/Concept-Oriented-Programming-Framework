// StatusGate Concept Handler — Functional Style
// Reports verification status to external gates (CI checks, webhooks, etc.).
// Uses perform("http", "POST", ...) for all provider HTTP calls, routing
// through the execution layer: ExternalCall → HttpProvider → endpoint.
//
// Default provider: "exit-code" (works in any CI with zero config).

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
import { autoInterpret } from '../../../runtime/functional-compat.ts';
  createProgram, get, put, find, pure, perform,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

// ── Handler ──────────────────────────────────────────────────────────

const _statusGateHandler: FunctionalConceptHandler = {

  report(input: Record<string, unknown>) {
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

    p = pure(p, {
      variant: 'ok',
      gate: id,
      target,
      provider: providerName,
    });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  update(input: Record<string, unknown>) {
    const gateId = input.gate as string;
    const status = input.status as string || '';
    const details = input.details as string || '';
    const now = new Date().toISOString();

    let p = createProgram();
    p = get(p, 'gates', gateId, 'gateData');
    p = put(p, 'gates', gateId, {
      status,
      details,
      updated_at: now,
    });

    // Provider dispatch via perform() — if provider requires HTTP,
    // the execution layer handles it. The provider name is stored in
    // the gate record and resolved at interpretation time.
    p = perform(p, 'http', 'POST', {
      endpoint: 'status-gate-provider',
      path: `/update/${gateId}`,
      body: JSON.stringify({ status, details }),
    }, 'updateResponse');

    p = pure(p, { variant: 'ok', gate: gateId, status });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  complete(input: Record<string, unknown>) {
    const gateId = input.gate as string;
    const finalStatus = (input.final_status as string) || '';
    const details = input.details as string || '';
    const now = new Date().toISOString();

    let p = createProgram();
    p = get(p, 'gates', gateId, 'gateData');
    p = put(p, 'gates', gateId, {
      status: finalStatus,
      details,
      completed: true,
      updated_at: now,
    });

    p = perform(p, 'http', 'POST', {
      endpoint: 'status-gate-provider',
      path: `/complete/${gateId}`,
      body: JSON.stringify({ status: finalStatus, details }),
    }, 'completeResponse');

    const accepted = finalStatus === 'passing';
    p = pure(p, { variant: 'ok', gate: gateId, accepted });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  configure(input: Record<string, unknown>) {
    const provider = (input.provider as string) || 'exit-code';
    const url = (input.url as string) || '';

    let p = createProgram();
    p = put(p, 'config', 'default', { provider, url });
    p = pure(p, { variant: 'ok', provider });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  get_status(input: Record<string, unknown>) {
    const gateId = input.gate as string;

    let p = createProgram();
    p = get(p, 'gates', gateId, 'gateData');
    p = pure(p, {
      variant: 'ok',
      gate: gateId,
      target: '',
      status: '',
      provider: '',
      details: '',
      completed: false,
    });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  list(input: Record<string, unknown>) {
    const target = input.target as string;

    let p = createProgram();
    p = find(p, 'gates', target ? { target } : {}, 'allGates');
    p = pure(p, { variant: 'ok', gates: '[]' });
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
