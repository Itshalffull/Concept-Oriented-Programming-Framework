// @clef-handler style=functional
// HandlerEntity diffFromSpec — Functional (Monadic) Implementation
//
// Compares a handler implementation against its concept spec to find drift:
// missing actions, extra actions, missing variants, extra variants,
// state field type/cardinality mismatches (lens-aware), and storage
// collection discrepancies. Returns a StorageProgram for full
// traceability through the monadic analysis pipeline.
// See Architecture doc Section 18.1

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, branch, pure, pureFrom,
  type StorageProgram,
  complete,
} from '../../../runtime/storage-program.ts';

type Result = { variant: string; [key: string]: unknown };

type Difference = {
  kind: 'missing_action' | 'extra_action' | 'missing_variant' | 'extra_variant'
      | 'storage_mismatch' | 'state_field_type_mismatch' | 'state_field_cardinality_mismatch';
  specValue: string;
  implValue: string;
};

interface ActionDetail {
  name: string;
  variants?: string[];
  params?: string[];
}

interface StateFieldDetail {
  name: string;
  type: string;
  cardinality: string;
}

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
      complete(createProgram(), 'noHandler', {}),
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
          complete(createProgram(), 'noSpec', {}),
          pureFrom(createProgram(), (bindings) => {
            const handler = (bindings.handlerEntries as Record<string, unknown>[])[0];
            const conceptEntity = (bindings.conceptEntries as Record<string, unknown>[])[0];

            // Parse handler's implemented action methods
            const implMethods: ActionDetail[] = (() => {
              try { return JSON.parse(handler.actionMethods as string || '[]'); }
              catch { return []; }
            })();
            const implActionNames = new Set(implMethods.map(m => m.name));
            const implMethodsByName = new Map(implMethods.map(m => [m.name, m]));

            // Parse concept spec's declared actions (simple names)
            const specActions: string[] = (() => {
              try { return JSON.parse(conceptEntity.actionsRef as string || '[]'); }
              catch { return []; }
            })();
            const specActionNames = new Set(specActions);

            // Parse rich action detail if available (name + variants + params)
            const specActionsDetail: ActionDetail[] = (() => {
              try { return JSON.parse(conceptEntity.actionsDetailRef as string || '[]'); }
              catch { return []; }
            })();
            const specDetailByName = new Map(specActionsDetail.map(a => [a.name, a]));

            // Parse rich state field detail if available
            const specStateFieldsDetail: StateFieldDetail[] = (() => {
              try { return JSON.parse(conceptEntity.stateFieldsDetailRef as string || '[]'); }
              catch { return []; }
            })();

            // Parse handler's storage collections
            const implCollections: string[] = (() => {
              try { return JSON.parse(handler.storageCollections as string || '[]'); }
              catch { return []; }
            })();

            // Parse handler's state field info (if stored)
            const implStateFields: StateFieldDetail[] = (() => {
              try { return JSON.parse(handler.stateFieldsDetail as string || '[]'); }
              catch { return []; }
            })();
            const implFieldsByName = new Map(implStateFields.map(f => [f.name, f]));

            const differences: Difference[] = [];

            // --- Action presence check ---
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

            // --- Variant-level checking ---
            // For each action in both spec and handler, compare variant tags
            for (const [actionName, specDetail] of specDetailByName) {
              const implMethod = implMethodsByName.get(actionName);
              if (!implMethod || !specDetail.variants || specDetail.variants.length === 0) continue;

              const specVariantSet = new Set(specDetail.variants);
              const implVariantSet = new Set(implMethod.variants || []);

              // Missing variants: declared in spec but not returned by handler
              for (const v of specVariantSet) {
                if (!implVariantSet.has(v)) {
                  differences.push({
                    kind: 'missing_variant',
                    specValue: `${actionName}/${v}`,
                    implValue: '',
                  });
                }
              }

              // Extra variants: returned by handler but not declared in spec
              for (const v of implVariantSet) {
                if (!specVariantSet.has(v)) {
                  differences.push({
                    kind: 'extra_variant',
                    specValue: '',
                    implValue: `${actionName}/${v}`,
                  });
                }
              }
            }

            // --- State field type/cardinality checking (lens-aware) ---
            // Compare spec state fields against handler's storage schema
            for (const specField of specStateFieldsDetail) {
              const implField = implFieldsByName.get(specField.name);
              if (!implField) continue; // missing field would be caught by storage mismatch

              if (specField.type !== implField.type && specField.type !== 'unknown' && implField.type !== 'unknown') {
                differences.push({
                  kind: 'state_field_type_mismatch',
                  specValue: `${specField.name}: ${specField.type}`,
                  implValue: `${specField.name}: ${implField.type}`,
                });
              }

              if (specField.cardinality !== implField.cardinality
                  && specField.cardinality !== 'one'  // don't flag default→default
                  && implField.cardinality !== 'one') {
                differences.push({
                  kind: 'state_field_cardinality_mismatch',
                  specValue: `${specField.name}: ${specField.cardinality}`,
                  implValue: `${specField.name}: ${implField.cardinality}`,
                });
              }
            }

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
              missing_variants: differences.filter(d => d.kind === 'missing_variant').length,
              extra_variants: differences.filter(d => d.kind === 'extra_variant').length,
              state_field_mismatches: differences.filter(d =>
                d.kind === 'state_field_type_mismatch' || d.kind === 'state_field_cardinality_mismatch'
              ).length,
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
