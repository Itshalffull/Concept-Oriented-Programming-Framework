// ============================================================
// copf dev
//
// Starts the development server — boots the sync engine,
// registers all local concepts, and listens for requests.
//
// Per Section 12: "Start the development server
// (engine + all local concepts)"
// ============================================================

import { readFileSync, existsSync } from 'fs';
import { resolve, relative, join } from 'path';
import { parseConceptFile } from '../../../../kernel/src/parser.js';
import { createInMemoryStorage } from '../../../../kernel/src/storage.js';
import { createInProcessAdapter, createConceptRegistry } from '../../../../kernel/src/transport.js';
import { SyncEngine, ActionLog } from '../../../../kernel/src/engine.js';
import { parseSyncFile } from '../../../../kernel/src/sync-parser.js';
import type { ConceptHandler, ConceptAST, ActionCompletion } from '../../../../kernel/src/types.js';
import { generateId, timestamp } from '../../../../kernel/src/types.js';
import { findFiles } from '../util.js';

export async function devCommand(
  _positional: string[],
  flags: Record<string, string | boolean>,
): Promise<void> {
  const projectDir = resolve(process.cwd());
  const specsDir = typeof flags.specs === 'string' ? flags.specs : 'specs';
  const syncsDir = typeof flags.syncs === 'string' ? flags.syncs : 'syncs';
  const implsDir = typeof flags.implementations === 'string'
    ? flags.implementations
    : 'implementations/typescript';
  const port = typeof flags.port === 'string' ? parseInt(flags.port, 10) : 3000;

  console.log('COPF Development Server\n');

  // Boot the sync engine
  const registry = createConceptRegistry();
  const log = new ActionLog();
  const engine = new SyncEngine(log, registry);

  // Register Web bootstrap concept
  const webHandler: ConceptHandler = {
    async respond(input) {
      return { variant: 'ok' };
    },
  };
  const webStorage = createInMemoryStorage();
  registry.register('urn:copf/Web', createInProcessAdapter(webHandler, webStorage));

  // Discover and register concepts
  const conceptFiles = findFiles(resolve(projectDir, specsDir), '.concept');
  let conceptCount = 0;

  for (const file of conceptFiles) {
    const source = readFileSync(file, 'utf-8');
    try {
      const ast = parseConceptFile(source);
      const uri = `urn:copf/${ast.name}`;

      // Try to load the implementation
      const implPath = findImplementation(projectDir, implsDir, ast.name);
      if (implPath) {
        try {
          const mod = await import(implPath);
          const handler = findHandler(mod);
          if (handler) {
            const storage = createInMemoryStorage();
            registry.register(uri, createInProcessAdapter(handler, storage));
            conceptCount++;
            console.log(`  Registered: ${ast.name} (${relative(projectDir, implPath)})`);
          } else {
            console.log(`  Skipped:    ${ast.name} (no handler export found)`);
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          console.log(`  Error:      ${ast.name} — ${message}`);
        }
      } else {
        console.log(`  Skipped:    ${ast.name} (no implementation found)`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`  Parse error: ${relative(projectDir, file)} — ${message}`);
    }
  }

  // Load sync definitions
  const syncFiles = findFiles(resolve(projectDir, syncsDir), '.sync');
  let syncCount = 0;

  for (const file of syncFiles) {
    const source = readFileSync(file, 'utf-8');
    try {
      const syncs = parseSyncFile(source);
      for (const sync of syncs) {
        engine.registerSync(sync);
        syncCount++;
      }
      console.log(
        `  Loaded syncs: ${relative(projectDir, file)} (${syncs.length} sync(s))`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`  Sync error:  ${relative(projectDir, file)} — ${message}`);
    }
  }

  console.log(
    `\n${conceptCount} concept(s), ${syncCount} sync(s) registered`,
  );
  console.log(`\nDev server ready. Listening on port ${port}...`);
  console.log('Press Ctrl+C to stop.\n');

  // Start a basic HTTP server for development
  const { createServer } = await import('http');

  const server = createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/flow') {
      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      req.on('end', async () => {
        try {
          const request = JSON.parse(body);
          const flowId = generateId();
          const requestId = generateId();

          // Track the response
          let response: Record<string, unknown> = {};
          const origRespond = webHandler.respond;
          webHandler.respond = async (input) => {
            response = { body: input.body, error: input.error, code: input.code };
            return { variant: 'ok' };
          };

          // Create the initial completion
          const completion: ActionCompletion = {
            id: generateId(),
            concept: 'urn:copf/Web',
            action: 'request',
            input: request,
            variant: 'ok',
            output: { request: requestId, ...request },
            flow: flowId,
            timestamp: timestamp(),
          };

          // Process through engine
          const invocations = await engine.onCompletion(completion);
          for (const inv of invocations) {
            const transport = registry.resolve(inv.concept);
            if (transport) {
              const result = await transport.invoke(inv);
              const followUp = await engine.onCompletion(result, inv.id);
              for (const f of followUp) {
                const t = registry.resolve(f.concept);
                if (t) await t.invoke(f);
              }
            }
          }

          webHandler.respond = origRespond;

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ flowId, ...response }));
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: message }));
        }
      });
    } else if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', concepts: conceptCount, syncs: syncCount }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found. POST to /flow or GET /health' }));
    }
  });

  server.listen(port, () => {
    console.log(`HTTP server listening on http://localhost:${port}`);
    console.log(`  POST /flow    — submit a flow request`);
    console.log(`  GET  /health  — health check`);
  });

  // Handle shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    server.close();
    process.exit(0);
  });

  // Keep the process running
  await new Promise(() => {});
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
