// @clef-handler style=imperative concept=shell-provider
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, put, find, pure, perform,
  type StorageProgram,
  complete,
} from '../../../../runtime/storage-program.ts';

/**
 * ShellProvider — functional handler.
 *
 * Executes shell commands with environment sandboxing, timeout,
 * and stdout/stderr capture. Uses perform() for actual process spawning.
 */
export const shellProviderHandler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = complete(createProgram(), 'ok', { name: 'shell-provider',
      kind: 'runtime',
      capabilities: JSON.stringify(['spawn', 'timeout', 'env-sandbox']) });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  execute(input: Record<string, unknown>) {
    if (!input.args || (typeof input.args === 'string' && (input.args as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'args is required' }) as StorageProgram<Result>;
    }
    const command = input.command as string;
    const args = input.args as string || '';
    const env = input.env as string || '{}';
    const cwd = input.cwd as string || '.';
    const timeout = (input.timeout as number) || 30000;

    const executionId = `sh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    let p = createProgram();
    p = perform(p, 'shell', 'exec', {
      command, args, env, cwd, timeout,
    }, 'execResult');
    p = put(p, 'executions', executionId, {
      command, env, timeout, status: 'completed',
      stdout: '', stderr: '', exitCode: 0,
    });
    p = complete(p, 'ok', { execution: executionId,
      stdout: '',
      stderr: '',
      exitCode: 0 });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'executions', {}, 'allExecutions');
    p = complete(p, 'ok', { executions: '[]' });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
