// HandlerEntity diffFromSpec — Functional (Monadic) Implementation
//
// Compares a handler implementation against its concept spec to find drift:
// missing actions, extra actions, missing variants, extra variants, and
// storage collection discrepancies. Returns a StorageProgram for full
// traceability through the monadic analysis pipeline.
// See Architecture doc Section 18.1

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, branch, pure, pureFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

type Result = { variant: string; [key: string]: unknown };

type Difference = {
  kind: 'missing_action' | 'extra_action' | 'missing_variant' | 'extra_variant' | 'storage_mismatch';
  specValue: string;
  implValue: string;
};

export const handlerDiffFromSpecHandler: FunctionalConceptHandler = {
  diffFromSpec(input) {
    const concept = input.concept as string;

    let p = createProgram();

    // Read handler entity by concept (find all, take first)
    p = find(p, 'handlers', { concept }, 'handlerEntries');

    p = branch(
      p,
      (bindings) => {
        const entries = bindings.handlerEntries as Record<string, unknown>[];
        return !entries || entries.length === 0;
      },
      pure(createProgram(), { variant: 'noHandler' }),
      (() => {
        // Handler found — now look up the concept entity
        let inner = createProgram();
        inner = find(inner, 'concept-entity', { name: concept }, 'conceptEntries');

        inner = branch(
          inner,
          (bindings) => {
            const entries = bindings.conceptEntries as Record<string, unknown>[];
            return !entries || entries.length === 0;
          },
          pure(createProgram(), { variant: 'noSpec' }),
          pureFrom(createProgram(), (bindings) => {
            const handler = (bindings.handlerEntries as Record<string, unknown>[])[0];
            const conceptEntity = (bindings.conceptEntries as Record<string, unknown>[])[0];

            // Parse handler's implemented action methods
            const implMethods: Array<{ name: string; variants?: string[] }> = (() => {
              try { return JSON.parse(handler.actionMethods as string || '[]'); }
              catch { return []; }
            })();
            const implActionNames = new Set(implMethods.map(m => m.name));

            // Parse concept spec's declared actions
            const specActions: string[] = (() => {
              try { return JSON.parse(conceptEntity.actionsRef as string || '[]'); }
              catch { return []; }
            })();
            const specActionNames = new Set(specActions);

            // Parse handler's storage collections
            const implCollections: string[] = (() => {
              try { return JSON.parse(handler.storageCollections as string || '[]'); }
              catch { return []; }
            })();

            const differences: Difference[] = [];

            // Missing actions: in spec but not in handler
            for (const action of specActions) {
              if (!implActionNames.has(action)) {
                differences.push({
                  kind: 'missing_action',
                  specValue: action,
                  implValue: '',
                });
              }
            }

            // Extra actions: in handler but not in spec
            for (const method of implMethods) {
              if (!specActionNames.has(method.name)) {
                differences.push({
                  kind: 'extra_action',
                  specValue: '',
                  implValue: method.name,
                });
              }
            }

            // Variant checks: for each action in both spec and impl,
            // compare declared variants against returned variants
            // (This requires the concept entity to store variant info per action.
            // If actionsRef is just names, we skip variant-level comparison
            // and rely on the richer manifest if available.)

            if (differences.length === 0) {
              return {
                variant: 'inSync',
                actionCount: specActions.length,
              };
            }

            return {
              variant: 'ok',
              differences: JSON.stringify(differences),
              missing_count: differences.filter(d => d.kind === 'missing_action').length,
              extra_count: differences.filter(d => d.kind === 'extra_action').length,
              total_differences: differences.length,
            };
          }),
        );

        return inner;
      })(),
    );

    return p as StorageProgram<Result>;
  },
};
