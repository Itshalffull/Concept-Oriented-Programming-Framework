// NextjsSdkTarget Concept Implementation
// Interface target concept for generating Next.js SDK client code from projections.
import type { ConceptHandler } from '@clef/runtime';

export const nextjsSdkTargetHandler: ConceptHandler = {
  async initialize(input, storage) {
    const config = input.config as string;

    let parsedConfig: Record<string, unknown>;
    try {
      parsedConfig = JSON.parse(config || '{}');
    } catch {
      return { variant: 'loadError', message: 'Configuration must be valid JSON' };
    }

    const appDir = (parsedConfig.appDir as string) || 'app';
    const srcDir = (parsedConfig.srcDir as string) || 'src';
    const typescript = parsedConfig.typescript !== false;
    const appRouter = parsedConfig.appRouter !== false;

    const instanceId = `nextjs-sdk-${Date.now()}`;

    try {
      await storage.put('nextjs-sdk-target', instanceId, {
        instanceId,
        appDir,
        srcDir,
        typescript,
        appRouter,
        status: 'initialized',
        createdAt: new Date().toISOString(),
      });

      return {
        variant: 'ok',
        instance: JSON.stringify({
          instanceId,
          appDir,
          srcDir,
          typescript,
          appRouter,
          status: 'initialized',
        }),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown initialization error';
      return { variant: 'loadError', message };
    }
  },
};
