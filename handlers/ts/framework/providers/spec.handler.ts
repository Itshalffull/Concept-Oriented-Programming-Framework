// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// Spec Coordination Handler
//
// Routes specification document generation to format-specific
// providers (OpenAPI, AsyncAPI).
// Architecture doc: Clef Bind, Section 1.5
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, merge, branch, complete, completeFrom,
  mapBindings, putFrom, mergeFrom, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';
import { randomUUID } from 'crypto';

type Result = { variant: string; [key: string]: unknown };

const _handler: FunctionalConceptHandler = {
  emit(input: Record<string, unknown>) {
    if (!input.projections || (typeof input.projections === 'string' && (input.projections as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'projections is required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    const projections = input.projections as string;
    const format = input.format as string;
    const config = input.config as string;

    if (!format) {
      return complete(p, 'error', { format: '', message: 'format is required' }) as StorageProgram<Result>;
    }

    const SUPPORTED_FORMATS = ['openapi', 'asyncapi', 'graphql', 'grpc', 'json-schema', 'markdown'];
    if (!SUPPORTED_FORMATS.includes(format.toLowerCase())) {
      return complete(p, 'error', { format, message: `Unsupported format: '${format}'. Supported: ${SUPPORTED_FORMATS.join(', ')}` }) as StorageProgram<Result>;
    }

    const docId = randomUUID();
    p = put(p, 'documents', docId, {
      id: docId,
      projections: projections || '[]',
      format,
      config: config || '{}',
      content: '',
      createdAt: new Date().toISOString(),
    });

    return complete(p, 'ok', { document: docId, content: '' }) as StorageProgram<Result>;
  },

  validate(input: Record<string, unknown>) {
    if (!input.document || (typeof input.document === 'string' && (input.document as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'document is required' }) as StorageProgram<Result>;
    }
    const p = createProgram();
    return complete(p, 'ok', { document: input.document as string }) as StorageProgram<Result>;
  },
};

export const specHandler = autoInterpret(_handler);
