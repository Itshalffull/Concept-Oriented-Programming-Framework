// ============================================================
// copf dev
//
// Starts the development server — boots the sync engine,
// registers all local concepts, and listens for requests.
// Phase 11: Watches .concept, .sync, and .impl.ts files for
// changes, hot-reloads syncs and concepts on modification.
//
// Per Section 12 and Section 16.3 of architecture doc.
// ============================================================

import { readFileSync, existsSync, watch as fsWatch } from 'fs';
import { resolve, relative, join, extname } from 'path';
import { parseConceptFile } from '../../../../kernel/src/parser.js';
import { createInMemoryStorage } from '../../../../kernel/src/storage.js';
import { createInProcessAdapter, createConceptRegistry } from '../../../../kernel/src/transport.js';
import { SyncEngine, ActionLog } from '../../../../kernel/src/engine.js';
import { parseSyncFile } from '../../../../kernel/src/sync-parser.js';
import type { ConceptHandler, ConceptAST, ActionCompletion, CompiledSync } from '../../../../kernel/src/types.js';
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

  // --- Phase 11: File watching for hot reload ---
  if (flags.watch !== false) {
    const watchDirs: string[] = [];
    const absSpecsDir = resolve(projectDir, specsDir);
    const absSyncsDir = resolve(projectDir, syncsDir);
    const absImplsDir = resolve(projectDir, implsDir);

    if (existsSync(absSpecsDir)) watchDirs.push(absSpecsDir);
    if (existsSync(absSyncsDir)) watchDirs.push(absSyncsDir);
    if (existsSync(absImplsDir)) watchDirs.push(absImplsDir);

    // Debounce: avoid rapid-fire reloads
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;
    const DEBOUNCE_MS = 200;

    /**
     * Re-compile and reload all sync files.
     * Builds a new sync set and atomically swaps via reloadSyncs().
     */
    function reloadAllSyncs(): void {
      const allSyncFiles = findFiles(absSyncsDir, '.sync');
      const newSyncs: CompiledSync[] = [];
      let errors = 0;

      for (const file of allSyncFiles) {
        const source = readFileSync(file, 'utf-8');
        try {
          const syncs = parseSyncFile(source);
          newSyncs.push(...syncs);
        } catch (err: unknown) {
          errors++;
          const message = err instanceof Error ? err.message : String(err);
          console.log(`  [hot-reload] Sync compile error: ${relative(projectDir, file)} — ${message}`);
        }
      }

      if (errors > 0) {
        console.log(`  [hot-reload] ${errors} sync error(s) — keeping old sync set active`);
        return;
      }

      engine.reloadSyncs(newSyncs);
      console.log(`  [hot-reload] Reloaded ${newSyncs.length} sync(s)`);
    }

    /**
     * Re-load a concept implementation.
     * Uses dynamic import with cache-busting to pick up changes.
     */
    async function reloadConcept(changedFile: string): Promise<void> {
      // Find the concept name from the implementation file
      const conceptName = extractConceptName(changedFile);
      if (!conceptName) return;

      const uri = `urn:copf/${conceptName}`;

      try {
        // Use cache-busting query param to force re-import
        const importPath = `${changedFile}?t=${Date.now()}`;
        const mod = await import(importPath);
        const handler = findHandler(mod);

        if (handler) {
          const storage = createInMemoryStorage();
          const transport = createInProcessAdapter(handler, storage);

          if (registry.reloadConcept) {
            registry.reloadConcept(uri, transport);
          } else {
            registry.register(uri, transport);
          }

          // Un-degrade any syncs that reference this concept
          const undegraded = engine.undegradeSyncsForConcept(uri);
          if (undegraded.length > 0) {
            console.log(`  [hot-reload] Un-degraded syncs: ${undegraded.join(', ')}`);
          }

          console.log(`  [hot-reload] Reloaded concept: ${conceptName}`);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.log(`  [hot-reload] Error reloading ${conceptName}: ${message}`);
      }
    }

    /**
     * Re-parse a concept spec. If the spec changed, re-compile syncs
     * (which validates against the new spec shape).
     */
    function reloadSpec(changedFile: string): void {
      const source = readFileSync(changedFile, 'utf-8');
      try {
        const ast = parseConceptFile(source);
        console.log(`  [hot-reload] Spec re-parsed: ${ast.name}`);
        // Re-compile syncs to validate against new spec
        reloadAllSyncs();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.log(`  [hot-reload] Spec parse error: ${relative(projectDir, changedFile)} — ${message}`);
        console.log(`  [hot-reload] Keeping old sync set active`);
      }
    }

    for (const dir of watchDirs) {
      try {
        fsWatch(dir, { recursive: true }, (eventType, filename) => {
          if (!filename) return;
          const fullPath = resolve(dir, filename);
          const ext = extname(filename);

          // Clear previous debounce timer
          if (reloadTimer) clearTimeout(reloadTimer);

          reloadTimer = setTimeout(() => {
            if (ext === '.sync') {
              console.log(`\n  [hot-reload] Sync changed: ${filename}`);
              reloadAllSyncs();
            } else if (ext === '.concept') {
              console.log(`\n  [hot-reload] Spec changed: ${filename}`);
              reloadSpec(fullPath);
            } else if (filename.endsWith('.impl.ts')) {
              console.log(`\n  [hot-reload] Implementation changed: ${filename}`);
              reloadConcept(fullPath);
            }
          }, DEBOUNCE_MS);
        });
      } catch {
        // fs.watch may not be available on all platforms
        console.log(`  [hot-reload] Warning: could not watch ${relative(projectDir, dir)}`);
      }
    }

    if (watchDirs.length > 0) {
      console.log(`\nFile watcher active (hot reload enabled)`);
      console.log(`  Watching: ${watchDirs.map(d => relative(projectDir, d)).join(', ')}`);
    }
  }

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

/**
 * Extract concept name from an implementation file path.
 * e.g. "echo.impl.ts" → "Echo", "jwt.impl.ts" → "JWT"
 */
function extractConceptName(filePath: string): string | null {
  const parts = filePath.split('/');
  const filename = parts[parts.length - 1];
  const match = filename.match(/^(.+)\.impl\.ts$/);
  if (!match) return null;

  const name = match[1];
  // Capitalize first letter; special cases for known acronyms
  const acronyms: Record<string, string> = { jwt: 'JWT' };
  if (acronyms[name]) return acronyms[name];
  return name.charAt(0).toUpperCase() + name.slice(1);
}
