// ============================================================
// Spec Coordination Handler
//
// Routes specification document generation to format-specific
// providers (OpenAPI, AsyncAPI).
// Architecture doc: Interface Kit, Section 1.5
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../../kernel/src/types.js';
import { randomUUID } from 'crypto';

export const specHandler: ConceptHandler = {
  async emit(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const projections = input.projections as string;
    const format = input.format as string;
    const config = input.config as string;

    if (!format) {
      return { variant: 'unsupportedFormat', format: '' };
    }

    const docId = randomUUID();
    await storage.put('documents', docId, {
      id: docId,
      projections: projections || '[]',
      format,
      config: config || '{}',
      content: '',
      createdAt: new Date().toISOString(),
    });

    return { variant: 'ok', document: docId, content: '' };
  },

  async validate(
    input: Record<string, unknown>,
    _storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    return { variant: 'ok', document: input.document as string };
  },
};
