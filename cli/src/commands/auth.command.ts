// ============================================================
// clef auth — Credential management commands
//
// Wraps the Credential concept to provide CLI auth profile
// management: add, login, store, list, remove.
//
// Section 3.3 — Credential concept
// Section 6.1 — CLI auth commands
// ============================================================

import { Command } from 'commander';
import { createInterface } from 'readline';
import { createInMemoryStorage } from '../../../runtime/adapters/storage.js';
import { credentialHandler } from '../../../handlers/ts/bind/credential.handler.js';
import type { ConceptStorage } from '../../../runtime/types.js';

// ─── Shared storage instance ─────────────────────────────────
// In a real deployment this would be backed by persistent storage
// (e.g., a local credential store). For now we use in-memory
// storage per CLI invocation; future work will wire this through
// a persistent adapter (e.g., OS keychain or encrypted file).
let _storage: ConceptStorage | null = null;

function getStorage(): ConceptStorage {
  if (!_storage) {
    _storage = createInMemoryStorage();
  }
  return _storage;
}

// ─── Helpers ─────────────────────────────────────────────────

/** Generate a deterministic profile ID from a human-readable name. */
function profileId(name: string): string {
  return `cred-${name}`;
}

/** Prompt for a single line of input on stdin (used by login for apikey/token). */
function promptSecret(message: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    rl.question(message, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/** Format a list of profiles as an aligned table. */
function formatProfileTable(profiles: Array<Record<string, unknown>>): string {
  if (profiles.length === 0) {
    return 'No profiles configured.';
  }

  // Column headers
  const headers = ['NAME', 'ENDPOINT', 'METHOD', 'STATUS'];

  // Compute column widths
  const widths = headers.map((h, i) => {
    const key = h.toLowerCase();
    return Math.max(h.length, ...profiles.map((p) => String(p[key] ?? '').length));
  });

  const pad = (s: string, w: number) => s + ' '.repeat(Math.max(0, w - s.length));
  const separator = widths.map((w) => '-'.repeat(w)).join('  ');

  const headerRow = headers.map((h, i) => pad(h, widths[i])).join('  ');
  const rows = profiles.map((p) =>
    headers.map((h, i) => pad(String(p[h.toLowerCase()] ?? ''), widths[i])).join('  '),
  );

  return [headerRow, separator, ...rows].join('\n');
}

// ─── Commander tree ──────────────────────────────────────────

export const authCliCommand = new Command('auth')
  .description('Manage authentication profiles (Credential concept).');

// ── clef auth add <name> --endpoint <url> --method <method> ──

authCliCommand
  .command('add <name>')
  .description('Create a new auth profile.')
  .requiredOption('--endpoint <url>', 'Kernel endpoint URL')
  .requiredOption('--method <method>', 'Auth method: apikey | oauth | token')
  .option('--json', 'Output as JSON')
  .action(async (name: string, opts: { endpoint: string; method: string; json?: boolean }) => {
    const storage = getStorage();
    const result = await credentialHandler.create(
      { profile: profileId(name), name, endpoint: opts.endpoint, method: opts.method },
      storage,
    );

    if (result.variant !== 'ok') {
      if (opts.json) {
        console.error(JSON.stringify(result));
      } else {
        console.error(`Error [${result.variant}]: ${result.message ?? 'Profile already exists'}`);
      }
      process.exitCode = 1;
      return;
    }

    if (opts.json) {
      console.log(JSON.stringify(result));
    } else {
      console.log(`Profile "${name}" created (endpoint: ${opts.endpoint}, method: ${opts.method}).`);
    }
  });

// ── clef auth login <name> ──────────────────────────────────

authCliCommand
  .command('login <name>')
  .description('Authenticate a profile. OAuth opens a browser; apikey/token prompts for input.')
  .option('--json', 'Output as JSON')
  .action(async (name: string, opts: { json?: boolean }) => {
    const storage = getStorage();
    const id = profileId(name);

    // First, verify the profile exists by attempting a load
    const loadResult = await credentialHandler.load({ profile: id }, storage);

    // loadResult.variant === 'notfound' means the profile doesn't exist at all.
    // 'expired' or 'ok' both mean the profile exists (expired just means no token yet).
    if (loadResult.variant === 'notfound') {
      if (opts.json) {
        console.error(JSON.stringify(loadResult));
      } else {
        console.error(`Error: no profile named "${name}" exists. Run "clef auth add ${name}" first.`);
      }
      process.exitCode = 1;
      return;
    }

    // Determine auth method from the stored profile.
    // We need to peek at the storage record directly since the handler
    // doesn't expose method in load's ok response.
    const record = await storage.get('credential_profile', id) as Record<string, unknown> | null;
    const method = (record?.method as string) || 'apikey';

    let token: string;

    if (method === 'oauth') {
      // OAuth flow — stub for now.
      // In a full implementation this would:
      //   1. Open the browser to the endpoint's OAuth authorize URL
      //   2. Start a local HTTP callback server on a random port
      //   3. Wait for the OAuth redirect with the authorization code
      //   4. Exchange the code for an access token
      console.log(`Opening browser for OAuth authentication with profile "${name}"...`);
      console.log('(OAuth browser flow is not yet implemented — provide a token manually)');
      token = await promptSecret('Paste token: ');
    } else {
      // apikey or token — prompt interactively
      const label = method === 'apikey' ? 'API key' : 'token';
      token = await promptSecret(`Enter ${label} for "${name}": `);
    }

    if (!token) {
      console.error('Error: no token provided.');
      process.exitCode = 1;
      return;
    }

    const storeResult = await credentialHandler.store(
      { profile: id, token },
      storage,
    );

    if (storeResult.variant !== 'ok') {
      if (opts.json) {
        console.error(JSON.stringify(storeResult));
      } else {
        console.error(`Error [${storeResult.variant}]: ${storeResult.message}`);
      }
      process.exitCode = 1;
      return;
    }

    if (opts.json) {
      console.log(JSON.stringify(storeResult));
    } else {
      console.log(`Profile "${name}" authenticated.`);
    }
  });

// ── clef auth store <name> --token <token> ──────────────────

authCliCommand
  .command('store <name>')
  .description('Store a token directly for non-interactive use.')
  .requiredOption('--token <token>', 'Token or API key to store')
  .option('--expires-at <timestamp>', 'Optional expiration timestamp (ISO 8601)')
  .option('--json', 'Output as JSON')
  .action(async (name: string, opts: { token: string; expiresAt?: string; json?: boolean }) => {
    const storage = getStorage();
    const result = await credentialHandler.store(
      {
        profile: profileId(name),
        token: opts.token,
        ...(opts.expiresAt ? { expiresAt: opts.expiresAt } : {}),
      },
      storage,
    );

    if (result.variant !== 'ok') {
      if (opts.json) {
        console.error(JSON.stringify(result));
      } else {
        console.error(`Error [${result.variant}]: ${result.message ?? 'Profile not found'}`);
      }
      process.exitCode = 1;
      return;
    }

    if (opts.json) {
      console.log(JSON.stringify(result));
    } else {
      console.log(`Token stored for profile "${name}".`);
    }
  });

// ── clef auth list ──────────────────────────────────────────

authCliCommand
  .command('list')
  .description('List all auth profiles (tokens are not displayed).')
  .option('--json', 'Output as JSON')
  .action(async (opts: { json?: boolean }) => {
    const storage = getStorage();
    const result = await credentialHandler.list({}, storage);

    if (result.variant !== 'ok') {
      if (opts.json) {
        console.error(JSON.stringify(result));
      } else {
        console.error(`Error [${result.variant}]: ${JSON.stringify(result)}`);
      }
      process.exitCode = 1;
      return;
    }

    const profiles = JSON.parse(result.profiles as string) as Array<Record<string, unknown>>;

    if (opts.json) {
      console.log(JSON.stringify(profiles, null, 2));
    } else {
      console.log(formatProfileTable(profiles));
    }
  });

// ── clef auth remove <name> ─────────────────────────────────

authCliCommand
  .command('remove <name>')
  .description('Remove an auth profile and its stored credentials.')
  .option('--json', 'Output as JSON')
  .action(async (name: string, opts: { json?: boolean }) => {
    const storage = getStorage();
    const result = await credentialHandler.remove(
      { profile: profileId(name) },
      storage,
    );

    if (result.variant !== 'ok') {
      if (opts.json) {
        console.error(JSON.stringify(result));
      } else {
        console.error(`Error [${result.variant}]: ${result.message ?? 'Profile not found'}`);
      }
      process.exitCode = 1;
      return;
    }

    if (opts.json) {
      console.log(JSON.stringify(result));
    } else {
      console.log(`Profile "${name}" removed.`);
    }
  });
