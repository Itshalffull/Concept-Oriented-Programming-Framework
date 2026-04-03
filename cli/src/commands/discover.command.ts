// ============================================================
// clef discover / describe — Discovery commands
//
// Wraps Connection/discover to list registered concepts and
// inspect their actions, inputs, and variants.
//
// Section 3.1 — Connection concept (discover action)
// Section 6.1 — CLI discover / describe commands
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

// ─── Shared storage ────────────────────────────────────────

let _storage: ConceptStorage | null = null;

function getStorage(): ConceptStorage {
  if (!_storage) {
    _storage = createInMemoryStorage();
  }
  return _storage;
}

// ─── Types for discovery results ───────────────────────────

interface ConceptEntry {
  name: string;
  actions: string[];
  variants?: string[];
}

interface SyncEntry {
  name: string;
  annotation: string;
  triggers: string[];
  effects: string[];
}

interface FullConceptEntry extends ConceptEntry {
  syncs: SyncEntry[];
  affordances: string[];
  widgets: string[];
}

interface DependencyEdge {
  from: string;
  to: string;
  via: string;
}

interface DiscoverResult {
  depth: string;
  scoreUnavailable?: boolean;
  note?: string;
  concepts: string[] | ConceptEntry[] | FullConceptEntry[];
  dependencyGraph?: DependencyEdge[];
}

// ─── Helpers ───────────────────────────────────────────────

/**
 * Seed the in-memory storage with the connection record from
 * the session so that Connection/discover can find it.
 */
async function seedConnection(session: SessionInfo, storage: ConceptStorage): Promise<void> {
  // Build a registeredConcepts JSON from the session's concept list.
  // The connect command stores richer entries; the session file only
  // has names. Rebuild a minimal object-array so discover works.
  const entries = session.registeredConcepts.map((name) => ({
    name,
    actions: [],
  }));
  await storage.put('connection', session.connectionId, {
    connection: session.connectionId,
    endpoint: session.endpoint,
    status: 'connected',
    session: session.session,
    registeredConcepts: JSON.stringify(entries),
  });
}

/**
 * Call Connection/discover and return the parsed result or null on error.
 */
async function callDiscover(
  session: SessionInfo,
  depth: string,
  concept?: string,
  json?: boolean,
): Promise<DiscoverResult | null> {
  const storage = getStorage();
  await seedConnection(session, storage);

  const input: Record<string, unknown> = {
    connection: session.connectionId,
    depth,
  };
  if (concept) {
    input.concept = concept;
  }

  const result = await connectionHandler.discover(input, storage);

  if (result.variant === 'disconnected') {
    if (json) {
      console.error(JSON.stringify(result));
    } else {
      console.error(`Error: ${result.message ?? 'Connection is disconnected.'}`);
      console.error('Run "clef connect <profile>" to re-establish the session.');
    }
    process.exitCode = 1;
    return null;
  }

  if (result.variant !== 'ok') {
    if (json) {
      console.error(JSON.stringify(result));
    } else {
      console.error(`Error [${result.variant}]: ${result.message ?? 'Discovery failed'}`);
    }
    process.exitCode = 1;
    return null;
  }

  try {
    return JSON.parse(result.result as string) as DiscoverResult;
  } catch {
    if (json) {
      console.error(JSON.stringify({ variant: 'error', message: 'Failed to parse discovery result' }));
    } else {
      console.error('Error: failed to parse discovery result from kernel.');
    }
    process.exitCode = 1;
    return null;
  }
}

// ─── Format helpers ────────────────────────────────────────

function formatConceptSummary(entry: ConceptEntry): string {
  const lines: string[] = [];
  lines.push(entry.name);
  if (entry.actions && entry.actions.length > 0) {
    for (const action of entry.actions) {
      lines.push(`  ${action}`);
    }
  }
  return lines.join('\n');
}

function formatConceptDetail(entry: ConceptEntry, actionFilter?: string): string {
  const lines: string[] = [];

  if (actionFilter) {
    // Single action detail
    const found = entry.actions?.includes(actionFilter);
    if (!found) {
      return `Action "${actionFilter}" not found on concept ${entry.name}.`;
    }
    lines.push(`${entry.name}/${actionFilter}`);
    // With the current placeholder data, we only have action names.
    // When the kernel returns richer manifests (inputs, variants),
    // this section will display full type signatures.
    lines.push(`  (no additional metadata available from kernel)`);
  } else {
    // Full concept summary with actions
    lines.push(entry.name);
    if (entry.actions && entry.actions.length > 0) {
      for (const action of entry.actions) {
        // Format: actionName(...) -> variants
        // With richer kernel data this will include typed inputs and variants
        lines.push(`  ${action}() -> ok`);
      }
    } else {
      lines.push('  (no actions registered)');
    }
    if (entry.variants && entry.variants.length > 0) {
      lines.push(`  variants: ${entry.variants.join(', ')}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format a Score-enriched full-depth concept entry.
 * Renders Actions, Syncs, Widgets, and Dependencies sections.
 */
function formatFullConceptDetail(entry: FullConceptEntry, depGraph: DependencyEdge[]): string {
  const lines: string[] = [];

  lines.push(entry.name);

  // Actions section
  lines.push('  Actions:');
  if (entry.actions && entry.actions.length > 0) {
    for (const action of entry.actions) {
      lines.push(`    ${action}() -> ok`);
    }
  } else {
    lines.push('    (no actions registered)');
  }

  // Syncs section
  lines.push('  Syncs:');
  if (entry.syncs && entry.syncs.length > 0) {
    for (const sync of entry.syncs) {
      const from = sync.triggers.join(', ') || '?';
      const to = sync.effects.join(', ') || '?';
      lines.push(`    ${sync.name}: ${from} → ${to}`);
    }
  } else {
    lines.push('    (none)');
  }

  // Widgets section
  lines.push('  Widgets:');
  if (entry.widgets && entry.widgets.length > 0) {
    for (const widget of entry.widgets) {
      lines.push(`    ${widget}`);
    }
  } else {
    lines.push('    (none)');
  }

  // Dependencies section — edges touching this concept
  const relevant = depGraph.filter((d) => d.from === entry.name || d.to === entry.name);
  lines.push('  Dependencies:');
  if (relevant.length > 0) {
    for (const edge of relevant) {
      lines.push(`    ${edge.from} → ${edge.to} (via ${edge.via})`);
    }
  } else {
    lines.push('    (none)');
  }

  return lines.join('\n');
}

// ─── Commander tree ─────────────────────────────────────────

export const discoverCliCommand = new Command('discover')
  .description('List all concepts registered on the connected kernel (Connection/discover).')
  .option('--json', 'Output as JSON')
  .action(async (opts: { json?: boolean }) => {
    const session = requireSession(opts.json);
    if (!session) return;

    const data = await callDiscover(session, 'list', undefined, opts.json);
    if (!data) return;

    if (opts.json) {
      console.log(JSON.stringify(data, null, 2));
    } else {
      const concepts = data.concepts as string[];
      if (concepts.length === 0) {
        console.log('No concepts registered.');
      } else {
        console.log(`${concepts.length} registered concept${concepts.length === 1 ? '' : 's'}:\n`);
        for (const name of concepts) {
          console.log(`  ${name}`);
        }
      }
    }
  });

export const describeCliCommand = new Command('describe')
  .description('Show details of a concept or action registered on the connected kernel (Connection/discover).')
  .argument('<target>', 'Concept name (e.g. "Task") or concept/action (e.g. "Task/create")')
  .option('--full', 'Show Score-enriched output: syncs, widgets, affordances, and dependency graph')
  .option('--json', 'Output as JSON')
  .action(async (target: string, opts: { full?: boolean; json?: boolean }) => {
    const session = requireSession(opts.json);
    if (!session) return;

    // Parse target: "Task" or "Task/create"
    const slashIndex = target.indexOf('/');
    const conceptName = slashIndex >= 0 ? target.slice(0, slashIndex) : target;
    const actionName = slashIndex >= 0 ? target.slice(slashIndex + 1) : undefined;

    const depth = opts.full ? 'full' : 'manifest';
    const data = await callDiscover(session, depth, conceptName, opts.json);
    if (!data) return;

    const entries = data.concepts as ConceptEntry[];

    if (entries.length === 0) {
      if (opts.json) {
        console.error(JSON.stringify({ variant: 'not_found', message: `Concept "${conceptName}" not found` }));
      } else {
        console.error(`Concept "${conceptName}" is not registered on this kernel.`);
      }
      process.exitCode = 1;
      return;
    }

    const entry = entries[0];

    if (opts.json) {
      if (opts.full) {
        // Return the full enriched result including score data
        const output: Record<string, unknown> = { ...data, concepts: [entry] };
        if (data.scoreUnavailable) {
          output.note = data.note ?? 'Score not loaded — use depth:full when Score is available for syncs/widgets/affordances';
        }
        console.log(JSON.stringify(output, null, 2));
      } else if (actionName) {
        // Filter to the specific action in JSON output
        const actionExists = entry.actions?.includes(actionName);
        if (!actionExists) {
          console.error(JSON.stringify({ variant: 'not_found', message: `Action "${actionName}" not found on ${conceptName}` }));
          process.exitCode = 1;
          return;
        }
        console.log(JSON.stringify({
          concept: conceptName,
          action: actionName,
          // When kernel provides richer data, include inputs and variants here
        }, null, 2));
      } else {
        console.log(JSON.stringify(entry, null, 2));
      }
    } else if (opts.full) {
      // Score-enriched human-readable output
      if (data.scoreUnavailable) {
        // Fall back to manifest-style display with a note
        console.log(formatConceptDetail(entry, actionName));
        console.log('');
        console.log('Note: Score not loaded — use depth:full when Score is available for syncs/widgets/affordances');
      } else {
        const fullEntry = entry as FullConceptEntry;
        const depGraph = data.dependencyGraph ?? [];
        console.log(formatFullConceptDetail(fullEntry, depGraph));
      }
    } else {
      console.log(formatConceptDetail(entry, actionName));
    }
  });
