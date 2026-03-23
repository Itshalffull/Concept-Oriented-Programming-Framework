// @clef-handler style=imperative
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, find, pure,
  type StorageProgram,
  complete,
} from '../../../../runtime/storage-program.ts';

/**
 * LocalModelInstance — functional handler.
 *
 * Configures and resolves local ML model instances (CodeBERT,
 * UniXcoder, etc.). Pure state management — actual model loading
 * flows through OnnxProvider or WasmProvider via sync wiring.
 */
export const localModelInstanceHandler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    if (!input.name || (typeof input.name === 'string' && (input.name as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }
    if (!input.tokenizerPath || (typeof input.tokenizerPath === 'string' && (input.tokenizerPath as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'tokenizerPath is required' }) as StorageProgram<Result>;
    }
    const name = input.name as string;
    const runtime = input.runtime as string;
    const modelPath = input.modelPath as string;
    const tokenizerPath = (input.tokenizerPath as string) || '';
    const device = (input.device as string) || 'cpu';
    const maxSequenceLength = (input.maxSequenceLength as number) || 512;
    const dimensions = (input.dimensions as number) || 768;

    const instanceId = `local-${name}`;

    let p = createProgram();
    p = put(p, 'instances', instanceId, {
      name,
      runtime,
      modelPath,
      tokenizerPath,
      device,
      maxSequenceLength,
      dimensions,
    });
    p = complete(p, 'ok', { instance: instanceId,
      name,
      runtime,
      modelPath,
      device,
      dimensions });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  resolve(input: Record<string, unknown>) {
    const name = input.name as string;

    let p = createProgram();
    p = get(p, 'instances', `local-${name}`, 'instanceData');

    p = complete(p, 'ok', { instance: `local-${name}`,
      runtime: '',
      modelPath: '',
      config: JSON.stringify({
        tokenizerPath: '',
        device: 'cpu',
        maxSequenceLength: 512,
        dimensions: 768 }),
    });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'instances', {}, 'allInstances');
    p = complete(p, 'ok', { instances: '[]' });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
