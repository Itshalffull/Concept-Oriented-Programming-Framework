// ============================================================
// Target Coordination Handler
//
// Routes generation requests to the appropriate target provider
// (RestTarget, GraphqlTarget, etc.) based on target type.
// Architecture doc: Clef Bind, Section 1.3
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../../runtime/types.js';
import { randomUUID } from 'crypto';

export const targetHandler: ConceptHandler = {
  async generate(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const projection = input.projection as string;
    const targetType = input.targetType as string;
    const config = input.config as string;

    if (!projection || !targetType) {
      return { variant: 'unsupportedTarget', target: targetType ?? '' };
    }

    const outputId = randomUUID();
    await storage.put('outputs', outputId, {
      id: outputId,
      projection,
      targetType,
      config: config || '{}',
      status: 'pending',
      files: [],
      createdAt: new Date().toISOString(),
    });

    return { variant: 'ok', output: outputId, files: [] };
  },

  async diff(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const output = input.output as string;
    const stored = await storage.get('outputs', output);
    if (!stored) return { variant: 'ok', changes: [] };
    return { variant: 'ok', changes: [] };
  },
};
