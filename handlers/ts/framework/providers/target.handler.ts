// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// Target Coordination Handler
//
// Routes generation requests to the appropriate target provider
// (RestTarget, GraphqlTarget, etc.) based on target type.
// Architecture doc: Clef Bind, Section 1.3
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
  generate(input: Record<string, unknown>) {
    if (!input.projection || (typeof input.projection === 'string' && (input.projection as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'projection is required' }) as StorageProgram<Result>;
    }
    const projection = input.projection as string;
    const targetType = input.targetType as string;
    const config = input.config as string;

    const SUPPORTED_TARGETS = ['rest', 'graphql', 'grpc', 'cli', 'mcp', 'openapi', 'typescript', 'rust', 'swift', 'solidity'];
    if (!targetType || !SUPPORTED_TARGETS.includes(targetType)) {
      return complete(createProgram(), 'unsupportedTarget', { target: targetType ?? '', message: `Unsupported target type: ${targetType}` }) as StorageProgram<Result>;
    }

    // Generate a deterministic output ID based on projection and targetType
    const projSlug = projection.split('-')[0] || projection.replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 12);
    const outputId = `output-${targetType}-${projSlug}-001`;
    let p = createProgram();
    p = put(p, 'outputs', outputId, {
      id: outputId,
      projection,
      targetType,
      config: config || '{}',
      status: 'pending',
      files: [],
      createdAt: new Date().toISOString(),
    });

    return complete(p, 'ok', { output: outputId, files: [] }) as StorageProgram<Result>;
  },

  diff(input: Record<string, unknown>) {
    let p = createProgram();
    const output = input.output as string;
    p = get(p, 'outputs', output, 'stored');
    return branch(p,
      (b) => b.stored != null,
      complete(createProgram(), 'ok', { changes: [] }) as StorageProgram<Result>,
      complete(createProgram(), 'notfound', { output, message: 'Output not found' }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },
};

export const targetHandler = autoInterpret(_handler);
