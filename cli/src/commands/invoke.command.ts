// ============================================================
// clef invoke — Generic concept action invocation via Connection
//
// Loads the active session from ~/.clef/session.json and dispatches
// an action through Connection/invoke. Provides reusable helpers
// (loadSession, invokeViaConnection) that generated typed commands
// (e.g. "clef task create") import internally.
//
// Section 3.1 — Connection concept
// Section 6.1 — CLI invoke command
// ============================================================

import { Command } from 'commander';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { createInMemoryStorage } from '../../../runtime/adapters/storage.js';
import { connectionHandler } from '../../../handlers/ts/bind/connection.handler.js';
import type { ConceptStorage } from '../../../runtime/types.js';

// ─── Session types ─────────────────────────────────────────

const SESSION_DIR = join(homedir(), '.clef');
const SESSION_FILE = join(SESSION_DIR, 'session.json');

export interface SessionInfo {
  profile: string;
  endpoint: string;
  connectionId: string;
  session: string;
  registeredConcepts: string[];
  connectedAt: string;
}

// ─── Exported helpers ──────────────────────────────────────

/**
 * Load the active Connection session from ~/.clef/session.json.
 *
 * Returns the parsed SessionInfo, or null if no session file exists
 * or the file is malformed. Other commands import this to obtain the
 * active connection without duplicating file-reading logic.
 */
export function loadSession(): SessionInfo | null {
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

/**
 * Invoke a concept action through the active Connection session.
 *
 * This is the building block for all Bind-generated typed CLI commands.
 * It loads the session, seeds the connection record into storage, and
 * calls Connection/invoke with the given concept, action, and input.
 *
 * Returns the raw result from Connection/invoke including variant and
 * output fields. Throws if no active session exists.
 */
export async function invokeViaConnection(
  concept: string,
  action: string,
  input: Record<string, unknown> = {},
): Promise<{ variant: string; [key: string]: unknown }> {
  const session = loadSession();
  if (!session) {
    return {
      variant: 'error',
      message: 'No active connection. Run "clef connect <profile>" first.',
    };
  }

  const storage = createInMemoryStorage() as ConceptStorage;

  // Seed the connection record so the handler can look it up.
  // The connect command wrote the full record; we reconstruct the
  // minimum fields that Connection/invoke needs for dispatch.
  await storage.put('connection', session.connectionId, {
    connection: session.connectionId,
    endpoint: session.endpoint,
    status: 'connected',
    session: session.session,
    registeredConcepts: JSON.stringify(
      session.registeredConcepts.map((name) => ({ name, actions: [] })),
    ),
  });

  const result = await connectionHandler.invoke(
    {
      connection: session.connectionId,
      concept,
      action,
      input: JSON.stringify(input),
    },
    storage,
  );

  return result as { variant: string; [key: string]: unknown };
}

// ─── Commander command ─────────────────────────────────────

export const invokeCliCommand = new Command('invoke')
  .description('Invoke a concept action on the connected kernel via Connection/invoke.')
  .argument('<concept>', 'Concept name (e.g. Task)')
  .argument('<action>', 'Action name (e.g. create)')
  .option('--input <json>', 'JSON input for the action', '{}')
  .option('--json', 'Output as JSON (machine-readable)')
  .action(async (concept: string, action: string, opts: { input: string; json?: boolean }) => {
    // Validate --input is parseable JSON before invoking
    let parsedInput: Record<string, unknown>;
    try {
      parsedInput = JSON.parse(opts.input);
    } catch {
      const msg = `Invalid JSON in --input: ${opts.input}`;
      if (opts.json) {
        console.error(JSON.stringify({ variant: 'error', message: msg }));
      } else {
        console.error(`Error: ${msg}`);
      }
      process.exitCode = 1;
      return;
    }

    const result = await invokeViaConnection(concept, action, parsedInput);

    // Handle error variants with appropriate exit codes
    if (result.variant !== 'ok') {
      if (opts.json) {
        console.error(JSON.stringify(result, null, 2));
      } else {
        switch (result.variant) {
          case 'not_found':
            console.error(
              `Error: ${result.message ?? `Concept "${concept}" or action "${action}" not found on this kernel.`}`,
            );
            break;
          case 'unauthorized':
            console.error(
              `Error: ${result.message ?? `Not authorized to invoke ${concept}/${action}.`}`,
            );
            break;
          default:
            console.error(
              `Error [${result.variant}]: ${result.message ?? 'Invocation failed'}`,
            );
            break;
        }
      }
      process.exitCode = 1;
      return;
    }

    // Success — print variant + output
    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`Variant: ${result.variant}`);
      if (result.output) {
        try {
          const parsed = JSON.parse(result.output as string);
          console.log(`Output:  ${JSON.stringify(parsed, null, 2)}`);
        } catch {
          console.log(`Output:  ${result.output}`);
        }
      }
    }
  });
