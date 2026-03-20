// @clef-handler style=imperative
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, find, pure, perform,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';

/**
 * OnnxProvider — functional handler.
 *
 * Loads and runs ONNX inference sessions. Uses perform() for
 * the actual model loading and inference execution.
 */
export const onnxProviderHandler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = pure(createProgram(), {
      variant: 'ok',
      name: 'onnx-provider',
      kind: 'runtime',
      capabilities: JSON.stringify(['cpu', 'cuda', 'tensorrt', 'batch']),
    });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  load(input: Record<string, unknown>) {
    const name = input.name as string;
    const modelPath = input.modelPath as string;
    const device = input.device as string || 'cpu';
    const options = input.options as string || '{}';

    const sessionId = `onnx-${name}`;

    let p = createProgram();
    p = perform(p, 'onnx', 'load', { name, modelPath, device, options }, 'loadResult');
    p = put(p, 'sessions', sessionId, {
      name, modelPath, device, options, status: 'ready',
      inputSchema: '', outputSchema: '',
    });
    p = pure(p, { variant: 'ok', session: sessionId });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  infer(input: Record<string, unknown>) {
    const session = input.session as string;
    const inputs = input.inputs as string;
    const options = input.options as string || '{}';

    const startTime = Date.now();

    let p = createProgram();
    p = get(p, 'sessions', `onnx-${session}`, 'sessionConfig');
    p = perform(p, 'onnx', 'infer', { session, inputs, options }, 'inferResult');
    p = pure(p, {
      variant: 'ok',
      outputs: '',
      timingMs: Date.now() - startTime,
    });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'sessions', {}, 'allSessions');
    p = pure(p, { variant: 'ok', sessions: '[]' });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
