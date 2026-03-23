// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// DevServer Handler
//
// Coordinate the local development server lifecycle: start,
// stop, and query status. File watching is delegated to
// Resource (change detection), recompilation is triggered by
// syncs (Resource changes -> generation pipeline), and output
// is written through Emitter (content-addressed writes).
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `dev-server-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  start(input: Record<string, unknown>) {
    if (!input.watchDirs || (typeof input.watchDirs === 'string' && (input.watchDirs as string).trim() === '')) {
      return complete(createProgram(), 'portInUse', { message: 'watchDirs is required' }) as StorageProgram<Result>;
    }
    const port = input.port as number;
    const watchDirs = input.watchDirs as string[];

    let p = createProgram();
    p = find(p, 'dev-server', { port }, 'existing');

    return branch(p,
      (bindings) => {
        const existing = bindings.existing as Record<string, unknown>[];
        return existing.filter(r => r.status === 'running').length > 0;
      },
      (thenP) => complete(thenP, 'portInUse', { port }),
      (elseP) => {
        const id = nextId();
        const now = new Date().toISOString();
        const url = `http://localhost:${port}`;

        elseP = put(elseP, 'dev-server', id, {
          id,
          port,
          status: 'running',
          watchDirs: JSON.stringify(watchDirs),
          startedAt: now,
          lastRecompile: now,
        });

        return complete(elseP, 'ok', { session: id, port, url });
      },
    ) as StorageProgram<Result>;
  },

  stop(input: Record<string, unknown>) {
    const session = input.session as string;

    if (!session || (typeof session === 'string' && session.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'session is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'dev-server', session, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = putFrom(thenP, 'dev-server', session, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, status: 'stopped' };
        });
        return complete(thenP, 'ok', { session });
      },
      (elseP) => complete(elseP, 'error', { message: `Session not found: ${session}` }),
    ) as StorageProgram<Result>;
  },

  status(input: Record<string, unknown>) {
    const session = input.session as string;

    let p = createProgram();
    p = get(p, 'dev-server', session, 'record');

    return branch(p,
      (bindings) => {
        const record = bindings.record as Record<string, unknown> | null;
        return !!record && record.status === 'running';
      },
      (thenP) => completeFrom(thenP, 'ok', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        const startedAt = new Date(record.startedAt as string);
        const now = new Date();
        const uptimeMs = now.getTime() - startedAt.getTime();
        const uptimeSeconds = Math.floor(uptimeMs / 1000);

        return {
          port: record.port as number,
          uptime: uptimeSeconds,
          lastRecompile: record.lastRecompile as string,
        };
      }),
      (elseP) => complete(elseP, 'stopped', { session }),
    ) as StorageProgram<Result>;
  },
};

export const devServerHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetDevServerCounter(): void {
  idCounter = 0;
}
