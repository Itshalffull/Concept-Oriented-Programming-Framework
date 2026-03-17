import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.ts';

export const programInterpreterHandler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    const interpreter = input.interpreter as string;
    const backend = input.backend as string;
    const mode = input.mode as string;

    const validModes = ['live', 'dry-run', 'replay'];
    if (!validModes.includes(mode)) {
      return { variant: 'invalidMode' };
    }

    const existing = await storage.get('interpreters', interpreter);
    if (existing) return { variant: 'exists' };

    await storage.put('interpreters', interpreter, { backend, mode });
    return { variant: 'ok' };
  },

  async execute(input: Record<string, unknown>, storage: ConceptStorage) {
    const interpreter = input.interpreter as string;
    const program = input.program as string;
    const snapshot = input.snapshot as string;

    const interp = await storage.get('interpreters', interpreter);
    if (!interp) return { variant: 'notfound' };

    const executionId = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const trace = JSON.stringify({ executionId, program, snapshot, startedAt: new Date().toISOString() });

    await storage.put('executions', executionId, {
      interpreterId: interpreter,
      program,
      snapshot,
      trace,
      completedAt: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      executionId,
      variant_result: 'ok',
      output: program,
      trace,
    };
  },

  async dryRun(input: Record<string, unknown>, storage: ConceptStorage) {
    const interpreter = input.interpreter as string;
    const program = input.program as string;
    const snapshot = input.snapshot as string;

    const interp = await storage.get('interpreters', interpreter);
    if (!interp) return { variant: 'notfound' };

    return {
      variant: 'ok',
      variant_result: 'ok',
      output: program,
      mutations: '[]',
    };
  },

  async rollback(input: Record<string, unknown>, storage: ConceptStorage) {
    const interpreter = input.interpreter as string;
    const executionId = input.executionId as string;

    const interp = await storage.get('interpreters', interpreter);
    if (!interp) return { variant: 'notfound' };

    const execution = await storage.get('executions', executionId);
    if (!execution) return { variant: 'notfound' };

    await storage.del('executions', executionId);
    return { variant: 'ok' };
  },
};
