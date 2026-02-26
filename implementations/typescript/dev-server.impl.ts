// ============================================================
// DevServer Handler
//
// Coordinate the local development server lifecycle: start,
// stop, and query status. File watching is delegated to
// Resource (change detection), recompilation is triggered by
// syncs (Resource changes -> generation pipeline), and output
// is written through Emitter (content-addressed writes).
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `dev-server-${++idCounter}`;
}

export const devServerHandler: ConceptHandler = {
  async start(input: Record<string, unknown>, storage: ConceptStorage) {
    const port = input.port as number;
    const watchDirs = input.watchDirs as string[];

    // Check if port is already in use by an existing session
    const existing = await storage.find('dev-server', { port });
    const runningOnPort = existing.filter(r => r.status === 'running');
    if (runningOnPort.length > 0) {
      return { variant: 'portInUse', port };
    }

    const id = nextId();
    const now = new Date().toISOString();
    const url = `http://localhost:${port}`;

    await storage.put('dev-server', id, {
      id,
      port,
      status: 'running',
      watchDirs: JSON.stringify(watchDirs),
      startedAt: now,
      lastRecompile: now,
    });

    return { variant: 'ok', session: id, port, url };
  },

  async stop(input: Record<string, unknown>, storage: ConceptStorage) {
    const session = input.session as string;

    const record = await storage.get('dev-server', session);
    if (!record) {
      return { variant: 'ok', session };
    }

    await storage.put('dev-server', session, {
      ...record,
      status: 'stopped',
    });

    return { variant: 'ok', session };
  },

  async status(input: Record<string, unknown>, storage: ConceptStorage) {
    const session = input.session as string;

    const record = await storage.get('dev-server', session);
    if (!record || record.status !== 'running') {
      return { variant: 'stopped' };
    }

    const startedAt = new Date(record.startedAt as string);
    const now = new Date();
    const uptimeMs = now.getTime() - startedAt.getTime();
    const uptimeSeconds = Math.floor(uptimeMs / 1000);

    return {
      variant: 'running',
      port: record.port as number,
      uptime: uptimeSeconds,
      lastRecompile: record.lastRecompile as string,
    };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetDevServerCounter(): void {
  idCounter = 0;
}
