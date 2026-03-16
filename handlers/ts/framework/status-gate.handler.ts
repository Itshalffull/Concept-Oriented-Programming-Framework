// StatusGate Concept Handler
// Reports verification status to external gates (CI checks, webhooks, etc.).
// Provider dispatch handled via syncs — this handler manages gate state
// and delegates to provider-specific concepts.
//
// Default provider: "exit-code" (works in any CI with zero config).

import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.js';

// ── Provider interface ───────────────────────────────────────────────

export interface StatusGateProvider {
  name: string;
  report(gate: GateRecord): Promise<ProviderResult>;
  update(gate: GateRecord): Promise<ProviderResult>;
}

interface ProviderResult {
  ok: boolean;
  message?: string;
}

interface GateRecord {
  id: string;
  target: string;
  context: string;
  status: string;
  details: string;
  provider: string;
  url: string;
  completed: boolean;
  reported_at: string;
  updated_at: string | null;
}

// ── Built-in providers ───────────────────────────────────────────────

/**
 * Exit-code provider: stores status and lets the CLI read it to
 * determine exit code. No external API calls.
 */
const exitCodeProvider: StatusGateProvider = {
  name: 'exit-code',
  async report() { return { ok: true }; },
  async update() { return { ok: true }; },
};

/**
 * GitHub Status Checks provider: POST to GitHub's statuses API.
 * Requires GITHUB_TOKEN and GITHUB_REPOSITORY env vars.
 */
const githubProvider: StatusGateProvider = {
  name: 'github',
  async report(gate) {
    return postGitHubStatus(gate);
  },
  async update(gate) {
    return postGitHubStatus(gate);
  },
};

async function postGitHubStatus(gate: GateRecord): Promise<ProviderResult> {
  const token = process.env['GITHUB_TOKEN'];
  const repo = process.env['GITHUB_REPOSITORY'];

  if (!token || !repo) {
    return {
      ok: false,
      message: 'GITHUB_TOKEN and GITHUB_REPOSITORY environment variables are required for the github provider.',
    };
  }

  const stateMap: Record<string, string> = {
    pending: 'pending',
    passing: 'success',
    failing: 'failure',
    error: 'error',
  };

  const body = {
    state: stateMap[gate.status] ?? 'pending',
    context: gate.context,
    description: (gate.details || '').slice(0, 140), // GitHub limit
    target_url: gate.url || undefined,
  };

  try {
    const response = await fetch(
      `https://api.github.com/repos/${repo}/statuses/${gate.target}`,
      {
        method: 'POST',
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      return { ok: false, message: `GitHub API ${response.status}: ${text.slice(0, 200)}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, message: `GitHub API error: ${(err as Error).message}` };
  }
}

/**
 * GitLab Commit Status provider: POST to GitLab's statuses API.
 * Requires GITLAB_TOKEN and CI_PROJECT_ID env vars.
 */
const gitlabProvider: StatusGateProvider = {
  name: 'gitlab',
  async report(gate) { return postGitLabStatus(gate); },
  async update(gate) { return postGitLabStatus(gate); },
};

async function postGitLabStatus(gate: GateRecord): Promise<ProviderResult> {
  const token = process.env['GITLAB_TOKEN'] ?? process.env['CI_JOB_TOKEN'];
  const projectId = process.env['CI_PROJECT_ID'];
  const apiUrl = process.env['CI_API_V4_URL'] ?? 'https://gitlab.com/api/v4';

  if (!token || !projectId) {
    return {
      ok: false,
      message: 'GITLAB_TOKEN (or CI_JOB_TOKEN) and CI_PROJECT_ID environment variables are required for the gitlab provider.',
    };
  }

  const stateMap: Record<string, string> = {
    pending: 'pending',
    passing: 'success',
    failing: 'failed',
    error: 'failed',
  };

  const params = new URLSearchParams({
    state: stateMap[gate.status] ?? 'pending',
    name: gate.context,
    description: (gate.details || '').slice(0, 140),
  });
  if (gate.url) params.set('target_url', gate.url);

  try {
    const response = await fetch(
      `${apiUrl}/projects/${projectId}/statuses/${gate.target}?${params}`,
      {
        method: 'POST',
        headers: {
          'PRIVATE-TOKEN': token,
        },
      },
    );

    if (!response.ok) {
      const text = await response.text();
      return { ok: false, message: `GitLab API ${response.status}: ${text.slice(0, 200)}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, message: `GitLab API error: ${(err as Error).message}` };
  }
}

/**
 * Webhook provider: POST gate status to a URL.
 * The URL comes from the gate's url field or CLEF_GATE_WEBHOOK_URL env var.
 */
const webhookProvider: StatusGateProvider = {
  name: 'webhook',
  async report(gate) { return postWebhook(gate); },
  async update(gate) { return postWebhook(gate); },
};

async function postWebhook(gate: GateRecord): Promise<ProviderResult> {
  const url = gate.url || process.env['CLEF_GATE_WEBHOOK_URL'];
  if (!url) {
    return { ok: false, message: 'No webhook URL configured. Set gate url or CLEF_GATE_WEBHOOK_URL.' };
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target: gate.target,
        context: gate.context,
        status: gate.status,
        details: gate.details,
        completed: gate.completed,
        reported_at: gate.reported_at,
      }),
    });

    if (!response.ok) {
      return { ok: false, message: `Webhook ${response.status}: ${(await response.text()).slice(0, 200)}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, message: `Webhook error: ${(err as Error).message}` };
  }
}

// ── Provider registry ────────────────────────────────────────────────

const providers = new Map<string, StatusGateProvider>([
  ['exit-code', exitCodeProvider],
  ['github', githubProvider],
  ['gitlab', gitlabProvider],
  ['webhook', webhookProvider],
]);

export function registerProvider(provider: StatusGateProvider): void {
  providers.set(provider.name, provider);
}

function resolveProvider(name: string): StatusGateProvider {
  return providers.get(name) ?? exitCodeProvider;
}

// ── Handler ──────────────────────────────────────────────────────────

export const statusGateHandler: ConceptHandler = {

  async report(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = `gate-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    // Resolve provider: explicit > configured default > exit-code
    const configuredDefault = await storage.get('config', 'default');
    const providerName = (input.provider as string) ||
      (configuredDefault?.provider as string) ||
      'exit-code';

    const configuredUrl = configuredDefault?.url as string || '';
    const url = (input.url as string) || configuredUrl;

    const gate: GateRecord = {
      id,
      target: input.target as string,
      context: input.context as string || 'clef/verify',
      status: input.status as string || 'pending',
      details: input.details as string || '',
      provider: providerName,
      url,
      completed: false,
      reported_at: now,
      updated_at: null,
    };

    // Persist gate
    await storage.put('gates', id, gate as unknown as Record<string, unknown>);

    // Dispatch to provider
    const provider = resolveProvider(providerName);
    const result = await provider.report(gate);

    if (!result.ok) {
      // Still save the gate (so it can be retried), but report provider error
      gate.status = 'error';
      await storage.put('gates', id, gate as unknown as Record<string, unknown>);
      return { variant: 'provider_error', provider: providerName, message: result.message || 'Provider failed' };
    }

    return { variant: 'ok', gate: id, target: gate.target, provider: providerName };
  },

  async update(input: Record<string, unknown>, storage: ConceptStorage) {
    const gateId = input.gate as string;
    const gate = await storage.get('gates', gateId) as unknown as GateRecord | null;

    if (!gate) {
      return { variant: 'not_found', gate: gateId };
    }

    if (gate.completed) {
      return { variant: 'already_completed', gate: gateId };
    }

    gate.status = input.status as string || gate.status;
    gate.details = input.details as string ?? gate.details;
    gate.updated_at = new Date().toISOString();

    await storage.put('gates', gateId, gate as unknown as Record<string, unknown>);

    const provider = resolveProvider(gate.provider);
    await provider.update(gate);

    return { variant: 'ok', gate: gateId, status: gate.status };
  },

  async complete(input: Record<string, unknown>, storage: ConceptStorage) {
    const gateId = input.gate as string;
    const gate = await storage.get('gates', gateId) as unknown as GateRecord | null;

    if (!gate) {
      return { variant: 'not_found', gate: gateId };
    }

    if (gate.completed) {
      return { variant: 'already_completed', gate: gateId };
    }

    gate.status = input.final_status as string || gate.status;
    gate.details = input.details as string ?? gate.details;
    gate.completed = true;
    gate.updated_at = new Date().toISOString();

    await storage.put('gates', gateId, gate as unknown as Record<string, unknown>);

    const provider = resolveProvider(gate.provider);
    await provider.update(gate);

    const accepted = gate.status === 'passing';
    return { variant: 'ok', gate: gateId, accepted };
  },

  async configure(input: Record<string, unknown>, storage: ConceptStorage) {
    const provider = input.provider as string || 'exit-code';
    const url = input.url as string || '';

    await storage.put('config', 'default', { provider, url });

    return { variant: 'ok', provider };
  },

  async get_status(input: Record<string, unknown>, storage: ConceptStorage) {
    const gateId = input.gate as string;
    const gate = await storage.get('gates', gateId) as unknown as GateRecord | null;

    if (!gate) {
      return { variant: 'not_found', gate: gateId };
    }

    return {
      variant: 'ok',
      gate: gateId,
      target: gate.target,
      status: gate.status,
      provider: gate.provider,
      details: gate.details,
      completed: gate.completed,
    };
  },

  async list(input: Record<string, unknown>, storage: ConceptStorage) {
    const target = input.target as string;
    const all = await storage.find('gates', target ? { target } : undefined);

    return {
      variant: 'ok',
      gates: JSON.stringify(all.map(g => ({
        id: g['id'] ?? g['_key'],
        target: g['target'],
        context: g['context'],
        status: g['status'],
        provider: g['provider'],
        completed: g['completed'],
      }))),
    };
  },
};

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
