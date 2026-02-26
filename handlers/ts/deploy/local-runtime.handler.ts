// LocalRuntime Concept Implementation
// Local process provider for the Runtime coordination concept. Manages
// child process PIDs, port assignments, and restart policies.
import type { ConceptHandler } from '../../../runtime/types.js';

const RELATION = 'local';

export const localRuntimeHandler: ConceptHandler = {
  async provision(input, storage) {
    const concept = input.concept as string;
    const command = input.command as string;
    const port = input.port as number;

    const processId = `proc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const pid = Math.floor(Math.random() * 60000) + 1000;
    const endpoint = `http://localhost:${port}`;

    await storage.put(RELATION, processId, {
      process: processId,
      concept,
      command,
      port,
      pid,
      endpoint,
      status: 'running',
      createdAt: new Date().toISOString(),
    });

    return { variant: 'ok', process: processId, pid, endpoint };
  },

  async deploy(input, storage) {
    const process = input.process as string;
    const command = input.command as string;

    const record = await storage.get(RELATION, process);
    if (!record) {
      return { variant: 'ok', process, pid: 0 };
    }

    const pid = Math.floor(Math.random() * 60000) + 1000;

    await storage.put(RELATION, process, {
      ...record,
      command,
      pid,
      status: 'running',
      deployedAt: new Date().toISOString(),
    });

    return { variant: 'ok', process, pid };
  },

  async setTrafficWeight(input, storage) {
    const process = input.process as string;

    return { variant: 'ok', process };
  },

  async rollback(input, storage) {
    const process = input.process as string;
    const previousCommand = input.previousCommand as string;

    const record = await storage.get(RELATION, process);
    const pid = Math.floor(Math.random() * 60000) + 1000;

    if (record) {
      await storage.put(RELATION, process, {
        ...record,
        command: previousCommand,
        pid,
        status: 'running',
      });
    }

    return { variant: 'ok', process, pid };
  },

  async destroy(input, storage) {
    const process = input.process as string;

    const record = await storage.get(RELATION, process);
    if (!record) {
      return { variant: 'ok', process };
    }

    await storage.del(RELATION, process);
    return { variant: 'ok', process };
  },
};
