// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// LocalRuntime Concept Implementation
// Local process provider for the Runtime coordination concept. Manages
// child process PIDs, port assignments, and restart policies.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, del, branch, complete, putFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const RELATION = 'local';

const _handler: FunctionalConceptHandler = {
  provision(input: Record<string, unknown>) {
    if (!input.concept || (typeof input.concept === 'string' && (input.concept as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'concept is required' }) as StorageProgram<Result>;
    }
    const concept = input.concept as string;
    const command = input.command as string;
    const port = input.port as number;

    const processId = `proc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const pid = Math.floor(Math.random() * 60000) + 1000;
    const endpoint = `http://localhost:${port}`;

    let p = createProgram();
    p = put(p, RELATION, processId, {
      process: processId,
      concept,
      command,
      port,
      pid,
      endpoint,
      status: 'running',
      createdAt: new Date().toISOString(),
    });

    return complete(p, 'ok', { process: processId, pid, endpoint }) as StorageProgram<Result>;
  },

  deploy(input: Record<string, unknown>) {
    if (!input.process || (typeof input.process === 'string' && (input.process as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'process is required' }) as StorageProgram<Result>;
    }
    const process = input.process as string;
    const command = input.command as string;

    let p = createProgram();
    p = get(p, RELATION, process, 'record');

    const pid = Math.floor(Math.random() * 60000) + 1000;

    p = branch(p, 'record',
      (b) => {
        const b2 = putFrom(b, RELATION, process, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return {
            ...record,
            command,
            pid,
            status: 'running',
            deployedAt: new Date().toISOString(),
          };
        });
        return complete(b2, 'ok', { process, pid });
      },
      (b) => complete(b, 'ok', { process, pid: 0 }),
    );

    return p as StorageProgram<Result>;
  },

  setTrafficWeight(input: Record<string, unknown>) {
    if (!input.process || (typeof input.process === 'string' && (input.process as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'process is required' }) as StorageProgram<Result>;
    }
    const process = input.process as string;
    let p = createProgram();
    return complete(p, 'ok', { process }) as StorageProgram<Result>;
  },

  rollback(input: Record<string, unknown>) {
    if (!input.process || (typeof input.process === 'string' && (input.process as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'process is required' }) as StorageProgram<Result>;
    }
    const process = input.process as string;
    const previousCommand = input.previousCommand as string;
    const pid = Math.floor(Math.random() * 60000) + 1000;

    let p = createProgram();
    p = get(p, RELATION, process, 'record');

    p = branch(p, 'record',
      (b) => {
        const b2 = putFrom(b, RELATION, process, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return {
            ...record,
            command: previousCommand,
            pid,
            status: 'running',
          };
        });
        return complete(b2, 'ok', { process, pid });
      },
      (b) => complete(b, 'ok', { process, pid }),
    );

    return p as StorageProgram<Result>;
  },

  destroy(input: Record<string, unknown>) {
    if (!input.process || (typeof input.process === 'string' && (input.process as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'process is required' }) as StorageProgram<Result>;
    }
    const process = input.process as string;

    let p = createProgram();
    p = get(p, RELATION, process, 'record');

    p = branch(p, 'record',
      (b) => {
        const b2 = del(b, RELATION, process);
        return complete(b2, 'ok', { process });
      },
      (b) => complete(b, 'ok', { process }),
    );

    return p as StorageProgram<Result>;
  },
};

export const localRuntimeHandler = autoInterpret(_handler);
