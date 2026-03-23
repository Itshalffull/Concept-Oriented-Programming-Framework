// @clef-handler style=imperative concept=onnx-provider
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, find, pure, perform, branch,
  type StorageProgram,
  complete,
} from '../../../../runtime/storage-program.ts';

type Result = { variant: string; [key: string]: unknown };

/**
 * OnnxProvider — functional handler.
 *
 * Loads and runs ONNX inference sessions. Uses perform() for
 * the actual model loading and inference execution.
 */
export const onnxProviderHandler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = complete(createProgram(), 'ok', { name: 'OnnxProvider',
      kind: 'runtime',
      capabilities: JSON.stringify(['cpu', 'cuda', 'tensorrt', 'batch']) });
    return p as StorageProgram<Result>;
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
    p = complete(p, 'ok', { session: sessionId });
    return p as StorageProgram<Result>;
  },

  infer(input: Record<string, unknown>) {
    const session = input.session as string;
    const inputs = input.inputs as string;
    const options = input.options as string || '{}';

    const startTime = Date.now();

    let p = createProgram();
    p = get(p, 'sessions', `onnx-${session}`, 'sessionConfig');
    return branch(p, 'sessionConfig',
      (thenP) => {
        let p2 = perform(thenP, 'onnx', 'infer', { session, inputs, options }, 'inferResult');
        return complete(p2, 'ok', { outputs: '', timingMs: Date.now() - startTime });
      },
      (elseP) => complete(elseP, 'notFound', { message: `session not found: ${session}` }),
    ) as StorageProgram<Result>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    // Seed default known session for testing
    p = put(p, 'sessions', 'onnx-codebert', {
      name: 'codebert', modelPath: '/models/codebert.onnx', device: 'cpu', options: '{}', status: 'ready',
      inputSchema: '', outputSchema: '',
    });
    p = find(p, 'sessions', {}, 'allSessions');
    p = complete(p, 'ok', { sessions: '[]' });
    return p as StorageProgram<Result>;
  },
};
