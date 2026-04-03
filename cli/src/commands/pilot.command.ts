// ============================================================
// clef pilot — Surface Pilot commands
//
// Wraps the Pilot derived concept to provide CLI control over
// a running Surface application: navigation, page inspection,
// widget interaction, and form operations.
//
// Section 5 — Pilot derived concept
// Section 6.1 — CLI pilot commands
// ============================================================

import { Command } from 'commander';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { connectionHandler } from '../../../handlers/ts/bind/connection.handler.js';
import { createInMemoryStorage } from '../../../runtime/adapters/storage.js';
import type { ConceptStorage } from '../../../runtime/types.js';

// ─── Session management ────────────────────────────────────
// Reads the active session established by `clef connect`.

const SESSION_FILE = join(homedir(), '.clef', 'session.json');

interface SessionInfo {
  profile: string;
  endpoint: string;
  connectionId: string;
  session: string;
  registeredConcepts: string[];
  connectedAt: string;
}

function loadSession(): SessionInfo | null {
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
 * Require an active session or print an error and set exit code.
 * Returns the session if available, null otherwise.
 */
function requireSession(json?: boolean): SessionInfo | null {
  const session = loadSession();
  if (!session) {
    if (json) {
      console.error(JSON.stringify({ variant: 'error', message: 'No active connection' }));
    } else {
      console.error('Error: no active connection. Run "clef connect <profile>" first.');
    }
    process.exitCode = 1;
    return null;
  }
  return session;
}

// ─── Shared storage instance ────────────────────────────────

let _storage: ConceptStorage | null = null;

function getStorage(): ConceptStorage {
  if (!_storage) {
    _storage = createInMemoryStorage();
  }
  return _storage;
}

// ─── Invoke helper ──────────────────────────────────────────
// All Pilot commands invoke concept actions through Connection/invoke.

interface InvokeResult {
  variant: string;
  [key: string]: unknown;
}

async function pilotInvoke(
  session: SessionInfo,
  concept: string,
  action: string,
  input: Record<string, unknown>,
): Promise<InvokeResult> {
  const storage = getStorage();
  const result = await connectionHandler.invoke(
    {
      connection: session.connectionId,
      concept,
      action,
      input: JSON.stringify(input),
    },
    storage,
  );
  return result as InvokeResult;
}

/**
 * Handle a non-ok invoke result. Prints error output and sets exit code.
 * Returns true if the result was an error (caller should return early).
 */
function handleError(result: InvokeResult, json?: boolean): boolean {
  if (result.variant === 'ok') return false;

  if (result.variant === 'not_found') {
    if (json) {
      console.error(JSON.stringify(result));
    } else {
      console.error(`Error: element not found. ${result.message ?? 'Check the label or destination name.'}`);
    }
    process.exitCode = 1;
    return true;
  }

  if (result.variant === 'disconnected') {
    if (json) {
      console.error(JSON.stringify(result));
    } else {
      console.error('Error: session is disconnected. Run "clef connect <profile>" to reconnect.');
    }
    process.exitCode = 1;
    return true;
  }

  if (json) {
    console.error(JSON.stringify(result));
  } else {
    console.error(`Error [${result.variant}]: ${result.message ?? 'Operation failed'}`);
  }
  process.exitCode = 1;
  return true;
}

// ─── Formatting helpers ────────────────────────────────────

/** Format a list of destinations as an aligned table. */
function formatDestinationTable(destinations: Array<Record<string, unknown>>): string {
  if (destinations.length === 0) {
    return 'No destinations available.';
  }

  const headers = ['NAME', 'HREF', 'GROUP', 'ICON'];
  const keys = ['name', 'href', 'group', 'icon'];

  const widths = headers.map((h, i) =>
    Math.max(h.length, ...destinations.map((d) => String(d[keys[i]] ?? '').length)),
  );

  const pad = (s: string, w: number) => s + ' '.repeat(Math.max(0, w - s.length));
  const separator = widths.map((w) => '-'.repeat(w)).join('  ');

  const headerRow = headers.map((h, i) => pad(h, widths[i])).join('  ');
  const rows = destinations.map((d) =>
    keys.map((k, i) => pad(String(d[k] ?? ''), widths[i])).join('  '),
  );

  return [headerRow, separator, ...rows].join('\n');
}

/** Format a PageMap snapshot as an aligned table. */
function formatSnapshotTable(entries: Array<Record<string, unknown>>): string {
  if (entries.length === 0) {
    return 'No interactive elements on the current page.';
  }

  const headers = ['LABEL', 'ROLE', 'STATE', 'EVENTS', 'BINDING'];
  const keys = ['label', 'role', 'currentState', 'validEvents', 'conceptBinding'];

  const formatValue = (val: unknown): string => {
    if (Array.isArray(val)) return val.join(', ');
    if (val === null || val === undefined) return '';
    return String(val);
  };

  const widths = headers.map((h, i) =>
    Math.max(h.length, ...entries.map((e) => formatValue(e[keys[i]]).length)),
  );

  const pad = (s: string, w: number) => s + ' '.repeat(Math.max(0, w - s.length));
  const separator = widths.map((w) => '-'.repeat(w)).join('  ');

  const headerRow = headers.map((h, i) => pad(h, widths[i])).join('  ');
  const rows = entries.map((e) =>
    keys.map((k, i) => pad(formatValue(e[k]), widths[i])).join('  '),
  );

  return [headerRow, separator, ...rows].join('\n');
}

/** Format overlay stack as a simple list. */
function formatOverlayList(overlays: Array<Record<string, unknown>>): string {
  if (overlays.length === 0) {
    return 'No overlays open.';
  }

  return overlays
    .map((o, i) => `  ${i + 1}. ${o.type ?? 'overlay'}: ${o.label ?? o.id ?? 'unnamed'}`)
    .join('\n');
}

// ─── Commander tree ─────────────────────────────────────────

export const pilotCliCommand = new Command('pilot')
  .description('Control a running Surface application (Pilot derived concept).');

// ── clef pilot navigate <destination> [--params <json>] ─────

pilotCliCommand
  .command('navigate <destination>')
  .description('Navigate to a destination by name or href.')
  .option('--params <json>', 'Navigation parameters as JSON')
  .option('--json', 'Output as JSON')
  .action(async (destination: string, opts: { params?: string; json?: boolean }) => {
    const session = requireSession(opts.json);
    if (!session) return;

    let params: Record<string, unknown> = {};
    if (opts.params) {
      try {
        params = JSON.parse(opts.params);
      } catch {
        if (opts.json) {
          console.error(JSON.stringify({ variant: 'error', message: 'Invalid JSON in --params' }));
        } else {
          console.error('Error: --params must be valid JSON.');
        }
        process.exitCode = 1;
        return;
      }
    }

    const result = await pilotInvoke(session, 'Pilot', 'navigate', { destination, params });
    if (handleError(result, opts.json)) return;

    if (opts.json) {
      console.log(JSON.stringify(result));
    } else {
      console.log(`Navigated to "${destination}".`);
    }
  });

// ── clef pilot back ─────────────────────────────────────────

pilotCliCommand
  .command('back')
  .description('Go back in navigation history.')
  .option('--json', 'Output as JSON')
  .action(async (opts: { json?: boolean }) => {
    const session = requireSession(opts.json);
    if (!session) return;

    const result = await pilotInvoke(session, 'Pilot', 'back', {});
    if (handleError(result, opts.json)) return;

    if (opts.json) {
      console.log(JSON.stringify(result));
    } else {
      console.log(`Navigated back.`);
      if (result.destination) {
        console.log(`  Now at: ${result.destination}`);
      }
    }
  });

// ── clef pilot forward ─────────────────────────────────────

pilotCliCommand
  .command('forward')
  .description('Go forward in navigation history.')
  .option('--json', 'Output as JSON')
  .action(async (opts: { json?: boolean }) => {
    const session = requireSession(opts.json);
    if (!session) return;

    const result = await pilotInvoke(session, 'Pilot', 'forward', {});
    if (handleError(result, opts.json)) return;

    if (opts.json) {
      console.log(JSON.stringify(result));
    } else {
      console.log(`Navigated forward.`);
      if (result.destination) {
        console.log(`  Now at: ${result.destination}`);
      }
    }
  });

// ── clef pilot where ───────────────────────────────────────

pilotCliCommand
  .command('where')
  .description('Show current destination, href, params, and Host status.')
  .option('--json', 'Output as JSON')
  .action(async (opts: { json?: boolean }) => {
    const session = requireSession(opts.json);
    if (!session) return;

    const result = await pilotInvoke(session, 'Pilot', 'where', {});
    if (handleError(result, opts.json)) return;

    if (opts.json) {
      console.log(JSON.stringify(result));
    } else {
      console.log(`Destination: ${result.destination ?? 'unknown'}`);
      if (result.href) console.log(`  Href:   ${result.href}`);
      if (result.params) console.log(`  Params: ${JSON.stringify(result.params)}`);
      if (result.status) console.log(`  Status: ${result.status}`);
    }
  });

// ── clef pilot destinations ─────────────────────────────────

pilotCliCommand
  .command('destinations')
  .description('List all available destinations with name, href, group, and icon.')
  .option('--json', 'Output as JSON')
  .action(async (opts: { json?: boolean }) => {
    const session = requireSession(opts.json);
    if (!session) return;

    const result = await pilotInvoke(session, 'Pilot', 'destinations', {});
    if (handleError(result, opts.json)) return;

    let destinations: Array<Record<string, unknown>> = [];
    if (result.destinations) {
      try {
        destinations = typeof result.destinations === 'string'
          ? JSON.parse(result.destinations)
          : result.destinations as Array<Record<string, unknown>>;
      } catch {
        destinations = [];
      }
    }

    if (opts.json) {
      console.log(JSON.stringify(destinations, null, 2));
    } else {
      console.log(formatDestinationTable(destinations));
    }
  });

// ── clef pilot snapshot ─────────────────────────────────────

pilotCliCommand
  .command('snapshot')
  .description('Show all interactive elements on the current page.')
  .option('--json', 'Output as JSON')
  .action(async (opts: { json?: boolean }) => {
    const session = requireSession(opts.json);
    if (!session) return;

    const result = await pilotInvoke(session, 'Pilot', 'snapshot', {});
    if (handleError(result, opts.json)) return;

    let entries: Array<Record<string, unknown>> = [];
    if (result.entries) {
      try {
        entries = typeof result.entries === 'string'
          ? JSON.parse(result.entries)
          : result.entries as Array<Record<string, unknown>>;
      } catch {
        entries = [];
      }
    }

    if (opts.json) {
      console.log(JSON.stringify(entries, null, 2));
    } else {
      console.log(formatSnapshotTable(entries));
    }
  });

// ── clef pilot read [label] [--part <part>] ─────────────────

pilotCliCommand
  .command('read [label]')
  .description('Read a widget\'s connected props or a View\'s resolved data.')
  .option('--part <part>', 'Specific anatomy part to read')
  .option('--json', 'Output as JSON')
  .action(async (label: string | undefined, opts: { part?: string; json?: boolean }) => {
    const session = requireSession(opts.json);
    if (!session) return;

    const input: Record<string, unknown> = {};
    if (label) input.label = label;
    if (opts.part) input.part = opts.part;

    const result = await pilotInvoke(session, 'Pilot', 'read', input);
    if (handleError(result, opts.json)) return;

    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      // Pretty-print the data payload
      const data = result.data ?? result.props ?? result;
      if (typeof data === 'object' && data !== null) {
        console.log(JSON.stringify(data, null, 2));
      } else {
        console.log(String(data));
      }
    }
  });

// ── clef pilot interact <label> <event> ─────────────────────

pilotCliCommand
  .command('interact <label> <event>')
  .description('Send an FSM event to a widget identified by label.')
  .option('--json', 'Output as JSON')
  .action(async (label: string, event: string, opts: { json?: boolean }) => {
    const session = requireSession(opts.json);
    if (!session) return;

    const result = await pilotInvoke(session, 'Pilot', 'interact', { label, event });
    if (handleError(result, opts.json)) return;

    if (opts.json) {
      console.log(JSON.stringify(result));
    } else {
      console.log(`Sent "${event}" to "${label}".`);
      if (result.newState) {
        console.log(`  New state: ${result.newState}`);
      }
    }
  });

// ── clef pilot fill <label> <field> <value> ─────────────────

pilotCliCommand
  .command('fill <label> <field> <value>')
  .description('Write a value to a form field, resolved by label and field name.')
  .option('--json', 'Output as JSON')
  .action(async (label: string, field: string, value: string, opts: { json?: boolean }) => {
    const session = requireSession(opts.json);
    if (!session) return;

    const result = await pilotInvoke(session, 'Pilot', 'fill', { label, field, value });
    if (handleError(result, opts.json)) return;

    if (opts.json) {
      console.log(JSON.stringify(result));
    } else {
      console.log(`Set "${field}" to "${value}" on "${label}".`);
    }
  });

// ── clef pilot submit <label> ───────────────────────────────

pilotCliCommand
  .command('submit <label>')
  .description('Invoke the concept action bound to a form widget.')
  .option('--json', 'Output as JSON')
  .action(async (label: string, opts: { json?: boolean }) => {
    const session = requireSession(opts.json);
    if (!session) return;

    const result = await pilotInvoke(session, 'Pilot', 'submit', { label });
    if (handleError(result, opts.json)) return;

    if (opts.json) {
      console.log(JSON.stringify(result));
    } else {
      console.log(`Submitted "${label}".`);
      if (result.actionResult) {
        console.log(`  Result: ${JSON.stringify(result.actionResult)}`);
      }
    }
  });

// ── clef pilot overlays ─────────────────────────────────────

pilotCliCommand
  .command('overlays')
  .description('Show the current overlay stack.')
  .option('--json', 'Output as JSON')
  .action(async (opts: { json?: boolean }) => {
    const session = requireSession(opts.json);
    if (!session) return;

    const result = await pilotInvoke(session, 'Pilot', 'overlays', {});
    if (handleError(result, opts.json)) return;

    let overlays: Array<Record<string, unknown>> = [];
    if (result.overlays) {
      try {
        overlays = typeof result.overlays === 'string'
          ? JSON.parse(result.overlays)
          : result.overlays as Array<Record<string, unknown>>;
      } catch {
        overlays = [];
      }
    }

    if (opts.json) {
      console.log(JSON.stringify(overlays, null, 2));
    } else {
      console.log('Overlay stack:');
      console.log(formatOverlayList(overlays));
    }
  });

// ── clef pilot dismiss ──────────────────────────────────────

pilotCliCommand
  .command('dismiss')
  .description('Dismiss the topmost overlay.')
  .option('--json', 'Output as JSON')
  .action(async (opts: { json?: boolean }) => {
    const session = requireSession(opts.json);
    if (!session) return;

    const result = await pilotInvoke(session, 'Pilot', 'dismiss', {});
    if (handleError(result, opts.json)) return;

    if (opts.json) {
      console.log(JSON.stringify(result));
    } else {
      console.log('Dismissed topmost overlay.');
    }
  });
