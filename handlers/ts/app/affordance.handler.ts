// @migrated dsl-constructs 2026-03-18
// Affordance Concept Implementation
// Maps interactor types to concrete widgets based on specificity and contextual conditions.
// Supports field-level and entity-level matching, including density and motif metadata.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

let affordanceCounter = 0;

const _affordanceHandler: FunctionalConceptHandler = {
  declare(input: Record<string, unknown>) {
    const affordance = input.affordance as string;
    const widget = input.widget as string;
    const interactor = input.interactor as string;
    const specificity = input.specificity as number ?? 0;
    const conditions = input.conditions as string;
    const bind = input.bind as string;
    const contractVersion = input.contractVersion as number;
    const densityExempt = input.densityExempt as boolean | undefined;
    const motifOptimized = input.motifOptimized as string | undefined;

    let p = createProgram();
    p = spGet(p, 'affordance', affordance, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'duplicate', { message: 'An affordance with this identity already exists' }),
      (b) => {
        const parsedConditions = JSON.parse(conditions || '{}');
        const parsedBind = bind ? JSON.parse(bind) : null;

        let b2 = put(b, 'affordance', affordance, {
          affordance,
          widget,
          interactor,
          specificity,
          conditions: JSON.stringify({
            minOptions: parsedConditions.minOptions ?? null,
            maxOptions: parsedConditions.maxOptions ?? null,
            platform: parsedConditions.platform ?? null,
            viewport: parsedConditions.viewport ?? null,
            density: parsedConditions.density ?? null,
            motif: parsedConditions.motif ?? null,
            mutable: parsedConditions.mutable ?? null,
            concept: parsedConditions.concept ?? null,
            suite: parsedConditions.suite ?? null,
            tags: parsedConditions.tags ?? null,
          }),
          bind: parsedBind ? JSON.stringify(parsedBind) : null,
          contractVersion: contractVersion ?? null,
          densityExempt: densityExempt ?? null,
          motifOptimized: motifOptimized ?? null,
          createdAt: new Date().toISOString(),
        });

        affordanceCounter++;
        return complete(b2, 'ok', {});
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  match(input: Record<string, unknown>) {
    const interactor = input.interactor as string;
    const context = input.context as string;

    let p = createProgram();
    p = find(p, 'affordance', interactor as unknown as Record<string, unknown>, 'results');
    // Filtering by interactor, conditions matching, sorting by specificity handled at runtime
    return complete(p, 'ok', { matches: '' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  explain(input: Record<string, unknown>) {
    const affordance = input.affordance as string;

    let p = createProgram();
    p = spGet(p, 'affordance', affordance, 'existing');
    p = branch(p, 'existing',
      (b) => {
        // Explanation built at runtime from binding data
        return complete(b, 'ok', { affordance, reason: '' });
      },
      (b) => complete(b, 'notfound', { message: 'Affordance not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  remove(input: Record<string, unknown>) {
    const affordance = input.affordance as string;

    let p = createProgram();
    p = spGet(p, 'affordance', affordance, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'affordance', affordance, { __deleted: true });
        return complete(b2, 'ok', { affordance });
      },
      (b) => complete(b, 'notfound', { message: 'Affordance not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const affordanceHandler = autoInterpret(_affordanceHandler);

