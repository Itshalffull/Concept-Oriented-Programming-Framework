// @migrated dsl-constructs 2026-03-18
// LocalRuntime Concept Implementation
// Manage local process deployments for development. Owns child process
// PIDs, port assignments, log file paths, and restart policies.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, del, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _localRuntimeHandler: FunctionalConceptHandler = {
  provision(input: Record<string, unknown>) {
    const concept = input.concept as string;
    const command = input.command as string;
    const port = input.port as number;

    let p = createProgram();
    p = find(p, 'process', {}, 'existingProcesses');

    // Port conflict detection requires runtime binding access;
    // simplified: proceed with provisioning
    const processId = `local-${concept.toLowerCase()}-${Date.now()}`;
    const pid = Math.floor(Math.random() * 50000) + 10000;
    const endpoint = `http://localhost:${port}`;

    p = put(p, 'process', processId, {
      command,
      workingDirectory: process.cwd(),
      port,
      envVars: JSON.stringify([]),
      pid,
      status: 'running',
      logPath: `/tmp/logs/${concept.toLowerCase()}.log`,
      createdAt: new Date().toISOString(),
    });

    return complete(p, 'ok', {
      process: processId,
      pid,
      endpoint,
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  deploy(input: Record<string, unknown>) {
    const proc = input.process as string;
    const command = input.command as string;

    const newPid = Math.floor(Math.random() * 50000) + 10000;

    let p = createProgram();
    p = spGet(p, 'process', proc, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'process', proc, {
          command,
          pid: newPid,
          status: 'running',
          lastDeployedAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', { process: proc, pid: newPid });
      },
      (b) => complete(b, 'ok', { process: proc, pid: newPid }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  setTrafficWeight(input: Record<string, unknown>) {
    const proc = input.process as string;
    // Traffic weight has no effect locally; always 100
    let p = createProgram();
    return complete(p, 'ok', { process: proc }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  rollback(input: Record<string, unknown>) {
    const proc = input.process as string;
    const previousCommand = input.previousCommand as string;

    const newPid = Math.floor(Math.random() * 50000) + 10000;

    let p = createProgram();
    p = spGet(p, 'process', proc, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'process', proc, {
          command: previousCommand,
          pid: newPid,
          status: 'running',
          lastDeployedAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', { process: proc, pid: newPid });
      },
      (b) => complete(b, 'ok', { process: proc, pid: newPid }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  destroy(input: Record<string, unknown>) {
    const proc = input.process as string;

    let p = createProgram();
    p = spGet(p, 'process', proc, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'process', proc, {
          pid: null,
          status: 'stopped',
        });
        b2 = del(b2, 'process', proc);
        return complete(b2, 'ok', { process: proc });
      },
      (b) => {
        let b2 = del(b, 'process', proc);
        return complete(b2, 'ok', { process: proc });
      },
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const localRuntimeHandler = autoInterpret(_localRuntimeHandler);

