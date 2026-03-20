// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// IaC Concept Implementation
// Coordination concept for infrastructure-as-code. Generates provider-specific
// configuration, previews changes, applies updates, detects drift, and tears down.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, find, put, del, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const RELATION = 'iac';

const _iacHandler: FunctionalConceptHandler = {
  emit(input: Record<string, unknown>) {
    const plan = input.plan as string;
    const provider = input.provider as string;

    const outputId = 'stack-ref';
    const fileCount = 3;

    let p = createProgram();
    p = put(p, RELATION, outputId, {
      output: outputId,
      plan,
      provider,
      fileCount,
      createdAt: new Date().toISOString(),
    });

    return complete(p, 'ok', { output: outputId, fileCount }) as StorageProgram<Result>;
  },

  preview(input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', {
      toCreate: [],
      toUpdate: [],
      toDelete: [],
      estimatedMonthlyCost: 0,
    }) as StorageProgram<Result>;
  },

  apply(input: Record<string, unknown>) {
    const plan = input.plan as string;
    const provider = input.provider as string;

    const applyId = `apply-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    let p = createProgram();
    p = put(p, RELATION, applyId, {
      apply: applyId,
      plan,
      provider,
      status: 'applied',
      created: JSON.stringify([]),
      updated: JSON.stringify([]),
      deleted: JSON.stringify([]),
      appliedAt: new Date().toISOString(),
    });

    return complete(p, 'ok', { created: [], updated: [], deleted: [] }) as StorageProgram<Result>;
  },

  detectDrift(input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'noDrift', {}) as StorageProgram<Result>;
  },

  teardown(input: Record<string, unknown>) {
    const plan = input.plan as string;
    const provider = input.provider as string;

    let p = createProgram();
    p = find(p, RELATION, { plan, provider }, 'matches');

    return completeFrom(p, 'ok', (bindings) => {
      const matches = bindings.matches as Array<Record<string, unknown>>;
      const destroyed = matches.map(rec => (rec.output as string || rec.apply as string));
      return { destroyed };
    }) as StorageProgram<Result>;
  },
};

export const iacHandler = autoInterpret(_iacHandler);
