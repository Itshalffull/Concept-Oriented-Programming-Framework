// @clef-handler style=functional
// ============================================================
// Adapter Concept Implementation
//
// LoRA/QLoRA weight management for parameter-efficient fine-tuning.
// Injects trainable low-rank decomposition matrices into frozen
// base model layers. Supports training, merging into base weights,
// hot-swapping at inference time, and composing multiple adapters.
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, find, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const VALID_TARGET_MODULES = ['query', 'value', 'key', 'output'];
const VALID_QUANTIZATIONS = ['none', '4bit', '8bit'];

let _adapterCounter = 0;
function generateAdapterId(): string {
  return `adapter-${Date.now()}-${++_adapterCounter}`;
}

const _adapterHandler: FunctionalConceptHandler = {
  create(input: Record<string, unknown>) {
    const name = input.name as string;
    const baseModelId = input.base_model_id as string;
    const rank = input.rank as number;
    const targetModules = input.target_modules as string[];
    const quantization = input.quantization as string;

    if (!name || name.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'name is required' }) as StorageProgram<Result>;
    }
    if (rank < 1 || rank > 256) {
      return complete(createProgram(), 'invalid', { message: `Invalid rank: ${rank}. Must be 1-256.` }) as StorageProgram<Result>;
    }
    if (!VALID_QUANTIZATIONS.includes(quantization)) {
      return complete(createProgram(), 'invalid', { message: `Unknown quantization: ${quantization}` }) as StorageProgram<Result>;
    }
    for (const mod of targetModules) {
      if (!VALID_TARGET_MODULES.includes(mod)) {
        return complete(createProgram(), 'invalid', { message: `Unknown target module: ${mod}` }) as StorageProgram<Result>;
      }
    }

    const id = generateAdapterId();
    let p = createProgram();
    p = put(p, 'adapters', id, {
      id,
      name,
      base_model_id: baseModelId,
      rank,
      target_modules: targetModules,
      quantization,
      weights: null,
      training_status: 'untrained',
      merged: false,
    });

    return complete(p, 'ok', { adapter: id }) as StorageProgram<Result>;
  },

  train(input: Record<string, unknown>) {
    const adapterId = input.adapter as string;
    const datasetRef = input.dataset_ref as string;
    const config = input.config as {
      learning_rate: number;
      epochs: number;
      batch_size: number;
    };

    let p = createProgram();
    p = get(p, 'adapters', adapterId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'error', { message: 'Adapter not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'adapters', adapterId, 'existing');
        b = mapBindings(b, (bindings) => {
          const adapter = bindings.existing as Record<string, unknown>;
          const rank = adapter.rank as number;
          const targetModules = adapter.target_modules as string[];

          // Estimate parameter counts based on rank and target modules
          // Typical transformer layer has ~768 hidden dims
          const hiddenDim = 768;
          const layerCount = 12;
          const trainableParams = rank * hiddenDim * 2 * targetModules.length * layerCount;
          const totalParams = hiddenDim * hiddenDim * 4 * layerCount; // rough estimate
          const trainablePct = (trainableParams / totalParams) * 100;

          return { trainableParams, totalParams, trainablePct };
        }, 'paramInfo');

        b = putFrom(b, 'adapters', adapterId, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return {
            ...existing,
            training_status: 'trained',
            weights: `[trained-weights-${datasetRef}]`,
          };
        });

        return completeFrom(b, 'ok', (bindings) => {
          const info = bindings.paramInfo as Record<string, unknown>;
          return {
            adapter: adapterId,
            trainable_params: info.trainableParams as number,
            total_params: info.totalParams as number,
            trainable_pct: info.trainablePct as number,
          };
        });
      })(),
    ) as StorageProgram<Result>;
  },

  merge(input: Record<string, unknown>) {
    const adapterId = input.adapter as string;

    let p = createProgram();
    p = get(p, 'adapters', adapterId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'not_trained', { message: 'Adapter not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'adapters', adapterId, 'existing');
        b = mapBindings(b, (bindings) => {
          const adapter = bindings.existing as Record<string, unknown>;
          return adapter.training_status as string;
        }, 'status');

        return branch(b,
          (bindings) => (bindings.status as string) !== 'trained',
          complete(createProgram(), 'not_trained', { message: 'Adapter not trained yet' }),
          (() => {
            let m = createProgram();
            m = get(m, 'adapters', adapterId, 'existing');
            const mergedModelId = `merged-${adapterId}-${Date.now()}`;
            m = putFrom(m, 'adapters', adapterId, (bindings) => {
              const existing = bindings.existing as Record<string, unknown>;
              return { ...existing, merged: true };
            });
            return complete(m, 'ok', { merged_model_id: mergedModelId });
          })(),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  swap(input: Record<string, unknown>) {
    const adapterId = input.adapter as string;
    const active = input.active as boolean;

    let p = createProgram();
    p = get(p, 'adapters', adapterId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'not_trained', { message: 'Adapter not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'adapters', adapterId, 'existing');
        b = mapBindings(b, (bindings) => {
          const adapter = bindings.existing as Record<string, unknown>;
          return adapter.training_status as string;
        }, 'status');

        return branch(b,
          (bindings) => (bindings.status as string) !== 'trained',
          complete(createProgram(), 'not_trained', { message: 'Adapter not trained' }),
          (() => {
            let s = createProgram();
            s = get(s, 'adapters', adapterId, 'existing');
            s = putFrom(s, 'adapters', adapterId, (bindings) => {
              const existing = bindings.existing as Record<string, unknown>;
              return { ...existing, active };
            });
            return complete(s, 'ok', { adapter: adapterId });
          })(),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  compose(input: Record<string, unknown>) {
    const adapterAId = input.adapter_a as string;
    const adapterBId = input.adapter_b as string;

    let p = createProgram();
    p = get(p, 'adapters', adapterAId, 'adapterA');
    p = get(p, 'adapters', adapterBId, 'adapterB');

    return branch(p,
      (bindings) => !bindings.adapterA || !bindings.adapterB,
      complete(createProgram(), 'incompatible', { message: 'One or both adapters not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'adapters', adapterAId, 'adapterA');
        b = get(b, 'adapters', adapterBId, 'adapterB');
        b = mapBindings(b, (bindings) => {
          const a = bindings.adapterA as Record<string, unknown>;
          const bAdpt = bindings.adapterB as Record<string, unknown>;
          return (a.base_model_id as string) === (bAdpt.base_model_id as string);
        }, 'compatible');

        return branch(b,
          (bindings) => !(bindings.compatible as boolean),
          complete(createProgram(), 'incompatible', {
            message: 'Adapters target different base models',
          }),
          (() => {
            const combinedId = generateAdapterId();
            let c = createProgram();
            c = get(c, 'adapters', adapterAId, 'adapterA');
            c = get(c, 'adapters', adapterBId, 'adapterB');
            c = putFrom(c, 'adapters', combinedId, (bindings) => {
              const a = bindings.adapterA as Record<string, unknown>;
              const bAdpt = bindings.adapterB as Record<string, unknown>;
              const aModules = a.target_modules as string[];
              const bModules = bAdpt.target_modules as string[];
              const allModules = [...new Set([...aModules, ...bModules])];

              return {
                id: combinedId,
                name: `${a.name}+${bAdpt.name}`,
                base_model_id: a.base_model_id,
                rank: Math.max(a.rank as number, bAdpt.rank as number),
                target_modules: allModules,
                quantization: a.quantization,
                weights: `[composed-${adapterAId}-${adapterBId}]`,
                training_status: 'trained',
                merged: false,
              };
            });
            return complete(c, 'ok', { combined: combinedId });
          })(),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  export(input: Record<string, unknown>) {
    const adapterId = input.adapter as string;
    const format = input.format as string;

    let p = createProgram();
    p = get(p, 'adapters', adapterId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'not_trained', { message: 'Nothing to export' }),
      (() => {
        let b = createProgram();
        b = get(b, 'adapters', adapterId, 'existing');
        b = mapBindings(b, (bindings) => {
          const adapter = bindings.existing as Record<string, unknown>;
          return adapter.training_status as string;
        }, 'status');

        return branch(b,
          (bindings) => (bindings.status as string) !== 'trained',
          complete(createProgram(), 'not_trained', { message: 'Nothing to export' }),
          (() => {
            const path = `/exports/${adapterId}.${format === 'safetensors' ? 'safetensors' : 'peft'}`;
            return complete(createProgram(), 'ok', { path });
          })(),
        );
      })(),
    ) as StorageProgram<Result>;
  },
};

export const adapterHandler = autoInterpret(_adapterHandler);
