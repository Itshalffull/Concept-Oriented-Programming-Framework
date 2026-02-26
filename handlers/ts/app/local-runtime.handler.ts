// LocalRuntime Concept Implementation
// Manage local process deployments for development. Owns child process
// PIDs, port assignments, log file paths, and restart policies.
import type { ConceptHandler } from '@clef/kernel';

export const localRuntimeHandler: ConceptHandler = {
  async provision(input, storage) {
    const concept = input.concept as string;
    const command = input.command as string;
    const port = input.port as number;

    // Check for port conflicts
    const existingProcesses = await storage.find('process');
    for (const existing of existingProcesses) {
      if ((existing.port as number) === port && existing.status === 'running') {
        return {
          variant: 'portInUse',
          port,
          existingPid: existing.pid as number,
        };
      }
    }

    const processId = `local-${concept.toLowerCase()}-${Date.now()}`;
    const pid = Math.floor(Math.random() * 50000) + 10000;
    const endpoint = `http://localhost:${port}`;

    await storage.put('process', processId, {
      command,
      workingDirectory: process.cwd(),
      port,
      envVars: JSON.stringify([]),
      pid,
      status: 'running',
      logPath: `/tmp/logs/${concept.toLowerCase()}.log`,
      createdAt: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      process: processId,
      pid,
      endpoint,
    };
  },

  async deploy(input, storage) {
    const proc = input.process as string;
    const command = input.command as string;

    const newPid = Math.floor(Math.random() * 50000) + 10000;

    const record = await storage.get('process', proc);
    if (record) {
      await storage.put('process', proc, {
        ...record,
        command,
        pid: newPid,
        status: 'running',
        lastDeployedAt: new Date().toISOString(),
      });
    }

    return {
      variant: 'ok',
      process: proc,
      pid: newPid,
    };
  },

  async setTrafficWeight(input, storage) {
    const proc = input.process as string;
    // Traffic weight has no effect locally; always 100
    return { variant: 'ok', process: proc };
  },

  async rollback(input, storage) {
    const proc = input.process as string;
    const previousCommand = input.previousCommand as string;

    const newPid = Math.floor(Math.random() * 50000) + 10000;

    const record = await storage.get('process', proc);
    if (record) {
      await storage.put('process', proc, {
        ...record,
        command: previousCommand,
        pid: newPid,
        status: 'running',
        lastDeployedAt: new Date().toISOString(),
      });
    }

    return {
      variant: 'ok',
      process: proc,
      pid: newPid,
    };
  },

  async destroy(input, storage) {
    const proc = input.process as string;

    const record = await storage.get('process', proc);
    if (record) {
      await storage.put('process', proc, {
        ...record,
        pid: null,
        status: 'stopped',
      });
    }

    await storage.delete('process', proc);

    return { variant: 'ok', process: proc };
  },
};
