// ============================================================
// clef connect / disconnect — Connection management commands
//
// Wraps the Connection and Credential concepts to establish and
// tear down sessions with a running Clef kernel instance.
//
// Section 3.1 — Connection concept
// Section 6.1 — CLI connect command
// ============================================================

import { Command } from 'commander';
import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir, homedir } from 'os';
import { createInMemoryStorage } from '../../../runtime/adapters/storage.js';
import { connectionHandler } from '../../../handlers/ts/bind/connection.handler.js';
import { credentialHandler } from '../../../handlers/ts/bind/credential.handler.js';
import type { ConceptStorage } from '../../../runtime/types.js';

// ─── Session file management ────────────────────────────────
// Stores active connection session info so subsequent CLI
// commands can reuse it without re-establishing the connection.

const SESSION_DIR = join(homedir(), '.clef');
const SESSION_FILE = join(SESSION_DIR, 'session.json');

interface SessionInfo {
  profile: string;
  endpoint: string;
  connectionId: string;
  session: string;
  registeredConcepts: string[];
  connectedAt: string;
}

function ensureSessionDir(): void {
  if (!existsSync(SESSION_DIR)) {
    mkdirSync(SESSION_DIR, { recursive: true });
  }
}

function writeSession(info: SessionInfo): void {
  ensureSessionDir();
  writeFileSync(SESSION_FILE, JSON.stringify(info, null, 2), 'utf-8');
}

function readSession(): SessionInfo | null {
  if (!existsSync(SESSION_FILE)) {
    return null;
  }
  try {
    const raw = readFileSync(SESSION_FILE, 'utf-8');
    return JSON.parse(raw) as SessionInfo;
  } catch {
    return null;
  }
}

function removeSession(): void {
  if (existsSync(SESSION_FILE)) {
    unlinkSync(SESSION_FILE);
  }
}

// ─── Shared storage instance ────────────────────────────────
// In a real deployment, credential storage would be shared with
// the auth command via a persistent adapter. For now, each CLI
// invocation uses in-memory storage; the auth workflow seeds the
// credential before connect consumes it.

let _storage: ConceptStorage | null = null;

function getStorage(): ConceptStorage {
  if (!_storage) {
    _storage = createInMemoryStorage();
  }
  return _storage;
}

// ─── Helpers ────────────────────────────────────────────────

/** Generate a deterministic profile ID from a human-readable name. */
function profileId(name: string): string {
  return `cred-${name}`;
}

/** Parse the registeredConcepts JSON into a name list. */
function parseConceptNames(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry: unknown) =>
      typeof entry === 'string' ? entry : (entry as Record<string, unknown>).name as string,
    );
  } catch {
    return [];
  }
}

// ─── Commander tree ─────────────────────────────────────────

export const connectCliCommand = new Command('connect')
  .description('Establish a connection to a running Clef kernel (Connection concept).')
  .argument('<profile>', 'Auth profile name (created via "clef auth add")')
  .option('--transport <adapter>', 'Transport adapter to use', 'websocket')
  .option('--json', 'Output as JSON')
  .action(async (profile: string, opts: { transport: string; json?: boolean }) => {
    const storage = getStorage();
    const id = profileId(profile);

    // Step 1: Load credential via Credential/load
    const loadResult = await credentialHandler.load({ profile: id }, storage);

    if (loadResult.variant === 'expired') {
      if (opts.json) {
        console.error(JSON.stringify({ variant: 'expired', message: 'Credentials expired or not yet set' }));
      } else {
        console.error(
          `Error: credentials for profile "${profile}" are expired or not yet set.\n` +
          `Run "clef auth login ${profile}" to re-authenticate.`,
        );
      }
      process.exitCode = 1;
      return;
    }

    if (loadResult.variant === 'notfound') {
      if (opts.json) {
        console.error(JSON.stringify({ variant: 'notfound', message: 'Profile not found' }));
      } else {
        console.error(
          `Error: no profile named "${profile}" exists.\n` +
          `Run "clef auth add ${profile} --endpoint <url> --method <method>" to create one.`,
        );
      }
      process.exitCode = 1;
      return;
    }

    const token = loadResult.token as string;
    const endpoint = loadResult.endpoint as string;

    // Step 2: Establish Connection/connect
    const connectionId = `conn-${profile}-${Date.now()}`;
    const connectResult = await connectionHandler.connect(
      {
        connection: connectionId,
        endpoint,
        transportAdapter: opts.transport,
        credentials: `Bearer ${token}`,
      },
      storage,
    );

    if (connectResult.variant === 'unreachable') {
      if (opts.json) {
        console.error(JSON.stringify(connectResult));
      } else {
        console.error(
          `Error: kernel at ${endpoint} is unreachable.\n` +
          `${connectResult.message ?? 'Check that the kernel is running and the endpoint is correct.'}`,
        );
      }
      process.exitCode = 1;
      return;
    }

    if (connectResult.variant === 'unauthorized') {
      if (opts.json) {
        console.error(JSON.stringify(connectResult));
      } else {
        console.error(
          `Error: the kernel rejected the supplied credentials.\n` +
          `Run "clef auth login ${profile}" to re-authenticate.`,
        );
      }
      process.exitCode = 1;
      return;
    }

    if (connectResult.variant !== 'ok') {
      if (opts.json) {
        console.error(JSON.stringify(connectResult));
      } else {
        console.error(`Error [${connectResult.variant}]: ${connectResult.message ?? 'Connection failed'}`);
      }
      process.exitCode = 1;
      return;
    }

    // Step 3: Discover registered concepts for the status display
    const discoverResult = await connectionHandler.discover(
      { connection: connectionId, depth: 'list' },
      storage,
    );

    let conceptNames: string[] = [];
    if (discoverResult.variant === 'ok' && discoverResult.result) {
      try {
        const discoveryData = JSON.parse(discoverResult.result as string);
        conceptNames = (discoveryData.concepts ?? []) as string[];
      } catch {
        conceptNames = [];
      }
    }

    // Step 4: Retrieve session token from stored connection record
    const connRecord = await storage.get('connection', connectionId) as Record<string, unknown> | null;
    const sessionToken = (connRecord?.session as string) ?? '';

    // Step 5: Write session info for subsequent commands
    const sessionInfo: SessionInfo = {
      profile,
      endpoint,
      connectionId,
      session: sessionToken,
      registeredConcepts: conceptNames,
      connectedAt: new Date().toISOString(),
    };
    writeSession(sessionInfo);

    // Step 6: Print connected status
    if (opts.json) {
      console.log(JSON.stringify(sessionInfo, null, 2));
    } else {
      console.log(`Connected to ${endpoint}`);
      console.log(`  Profile:    ${profile}`);
      console.log(`  Transport:  ${opts.transport}`);
      console.log(`  Session:    ${sessionToken}`);
      console.log(`  Concepts:   ${conceptNames.length} registered`);
      if (conceptNames.length > 0) {
        console.log(`              ${conceptNames.join(', ')}`);
      }
    }
  });

// ── clef disconnect ─────────────────────────────────────────

export const disconnectCliCommand = new Command('disconnect')
  .description('Disconnect from the current Clef kernel session (Connection concept).')
  .option('--json', 'Output as JSON')
  .action(async (opts: { json?: boolean }) => {
    const session = readSession();

    if (!session) {
      if (opts.json) {
        console.error(JSON.stringify({ variant: 'error', message: 'No active connection' }));
      } else {
        console.error('Error: no active connection. Run "clef connect <profile>" first.');
      }
      process.exitCode = 1;
      return;
    }

    const storage = getStorage();

    // Call Connection/disconnect
    const result = await connectionHandler.disconnect(
      { connection: session.connectionId },
      storage,
    );

    // Remove session file regardless of disconnect outcome (idempotent cleanup)
    removeSession();

    if (result.variant !== 'ok') {
      if (opts.json) {
        console.error(JSON.stringify(result));
      } else {
        console.error(`Error [${result.variant}]: ${result.message ?? 'Disconnect failed'}`);
      }
      process.exitCode = 1;
      return;
    }

    if (opts.json) {
      console.log(JSON.stringify({ variant: 'ok', profile: session.profile, endpoint: session.endpoint }));
    } else {
      console.log(`Disconnected from ${session.endpoint} (profile: ${session.profile}).`);
    }
  });
