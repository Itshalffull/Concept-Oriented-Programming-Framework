// @migrated dsl-constructs 2026-03-18
// NextjsSdkTarget Concept Implementation
// Interface target concept for generating Next.js SDK client code from projections.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, put, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

export const nextjsSdkTargetHandler: FunctionalConceptHandler = {
  initialize(input: Record<string, unknown>) {
    const config = input.config as string;

    let p = createProgram();

    let parsedConfig: Record<string, unknown>;
    try {
      parsedConfig = JSON.parse(config || '{}');
    } catch {
      return complete(p, 'loadError', { message: 'Configuration must be valid JSON' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    const appDir = (parsedConfig.appDir as string) || 'app';
    const srcDir = (parsedConfig.srcDir as string) || 'src';
    const typescript = parsedConfig.typescript !== false;
    const appRouter = parsedConfig.appRouter !== false;

    const instanceId = `nextjs-sdk-${Date.now()}`;

    p = put(p, 'nextjs-sdk-target', instanceId, {
      instanceId,
      appDir,
      srcDir,
      typescript,
      appRouter,
      status: 'initialized',
      createdAt: new Date().toISOString(),
    });

    return complete(p, 'ok', {
      instance: JSON.stringify({
        instanceId,
        appDir,
        srcDir,
        typescript,
        appRouter,
        status: 'initialized',
      }),
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
