// ============================================================
// copf trace <flow-id>
//
// Renders a FlowTrace as a tree for debugging.
//
// Flags:
//   --failed   Filter to only failed/unfired branches
//   --json     Output FlowTrace as JSON for tooling
//
// Per Architecture doc Section 16.1.
// ============================================================

import { readFileSync, existsSync } from 'fs';
import { resolve, relative, join } from 'path';
import { parseConceptFile } from '../../../../kernel/src/parser.js';
import { createInMemoryStorage } from '../../../../kernel/src/storage.js';
import { createInProcessAdapter, createConceptRegistry } from '../../../../kernel/src/transport.js';
import { SyncEngine, ActionLog } from '../../../../kernel/src/engine.js';
import { parseSyncFile } from '../../../../kernel/src/sync-parser.js';
import { buildFlowTrace, renderFlowTrace } from '../../../../kernel/src/flow-trace.js';
import type { ConceptHandler } from '../../../../kernel/src/types.js';
import { findFiles } from '../util.js';

export async function traceCommand(
  positional: string[],
  flags: Record<string, string | boolean>,
): Promise<void> {
  const flowId = positional[0];
  if (!flowId) {
    console.error('Usage: copf trace <flow-id> [--failed] [--json]');
    console.error('\nRender a flow trace for debugging.');
    console.error('\nFlags:');
    console.error('  --failed   Show only failed/unfired branches');
    console.error('  --json     Output as JSON for tooling');
    process.exit(1);
  }

  const projectDir = resolve(process.cwd());
  const specsDir = typeof flags.specs === 'string' ? flags.specs : 'specs';
  const syncsDir = typeof flags.syncs === 'string' ? flags.syncs : 'syncs';
  const implsDir = typeof flags.implementations === 'string'
    ? flags.implementations
    : 'implementations/typescript';

  // Boot engine to get sync index (needed for unfired sync detection)
  const registry = createConceptRegistry();
  const log = new ActionLog();
  const engine = new SyncEngine(log, registry);

  // Register Web bootstrap concept
  const webHandler: ConceptHandler = {
    async respond() { return { variant: 'ok' }; },
  };
  const webStorage = createInMemoryStorage();
  registry.register('urn:copf/Web', createInProcessAdapter(webHandler, webStorage));

  // Discover and register concepts (for sync index)
  const conceptFiles = findFiles(resolve(projectDir, specsDir), '.concept');
  for (const file of conceptFiles) {
    const source = readFileSync(file, 'utf-8');
    try {
      const ast = parseConceptFile(source);
      const uri = `urn:copf/${ast.name}`;
      const implPath = findImplementation(projectDir, implsDir, ast.name);
      if (implPath) {
        try {
          const mod = await import(implPath);
          const handler = findHandler(mod);
          if (handler) {
            const storage = createInMemoryStorage();
            registry.register(uri, createInProcessAdapter(handler, storage));
          }
        } catch {
          // Skip concepts that fail to load
        }
      }
    } catch {
      // Skip specs that fail to parse
    }
  }

  // Load sync definitions (needed for unfired sync detection)
  const syncFiles = findFiles(resolve(projectDir, syncsDir), '.sync');
  for (const file of syncFiles) {
    const source = readFileSync(file, 'utf-8');
    try {
      const syncs = parseSyncFile(source);
      for (const sync of syncs) {
        engine.registerSync(sync);
      }
    } catch {
      // Skip sync files that fail to parse
    }
  }

  // Look for a flow log file (in dev mode, flow logs are stored)
  // For now, inform the user that trace works with the programmatic API
  // (kernel.getFlowTrace) and the dev server would need to persist flow logs
  const logFile = typeof flags.log === 'string'
    ? resolve(flags.log)
    : resolve(projectDir, '.copf', 'flows', `${flowId}.json`);

  if (!existsSync(logFile)) {
    console.error(`Flow log not found: ${logFile}`);
    console.error('\nThe trace command reads flow logs from .copf/flows/<flow-id>.json');
    console.error('In development, use kernel.getFlowTrace(flowId) for programmatic access.');
    console.error('\nTo supply a flow log file:');
    console.error('  copf trace <flow-id> --log <path-to-flow-log.json>');
    process.exit(1);
  }

  // Parse the flow log
  const logData = JSON.parse(readFileSync(logFile, 'utf-8'));

  // Reconstruct the ActionLog from persisted records
  for (const record of logData.records || []) {
    if (record.type === 'completion') {
      log.append({
        id: record.id,
        concept: record.concept,
        action: record.action,
        input: record.input || {},
        variant: record.variant || 'ok',
        output: record.output || {},
        flow: record.flow,
        timestamp: record.timestamp,
      }, record.parent);
    } else if (record.type === 'invocation') {
      log.appendInvocation({
        id: record.id,
        concept: record.concept,
        action: record.action,
        input: record.input || {},
        flow: record.flow,
        sync: record.sync,
        timestamp: record.timestamp,
      }, record.parent);
    }
  }

  // Build the trace
  const trace = buildFlowTrace(
    flowId,
    log,
    engine.getSyncIndex(),
    engine.getRegisteredSyncs(),
  );

  if (!trace) {
    console.error(`No trace data found for flow: ${flowId}`);
    process.exit(1);
  }

  // Render
  const output = renderFlowTrace(trace, {
    failed: flags.failed === true,
    json: flags.json === true,
  });

  console.log(output);
}

function findImplementation(
  projectDir: string,
  implsDir: string,
  conceptName: string,
): string | null {
  const lowerName = conceptName.toLowerCase();
  const candidates = [
    join(projectDir, implsDir, 'app', `${lowerName}.impl.ts`),
    join(projectDir, implsDir, 'framework', `${lowerName}.impl.ts`),
    join(projectDir, implsDir, `${lowerName}.impl.ts`),
  ];

  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  return null;
}

function findHandler(mod: Record<string, unknown>): ConceptHandler | null {
  for (const key of Object.keys(mod)) {
    if (key.endsWith('Handler') && typeof mod[key] === 'object' && mod[key] !== null) {
      return mod[key] as ConceptHandler;
    }
  }
  return null;
}
