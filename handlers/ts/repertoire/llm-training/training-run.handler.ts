// @clef-handler style=functional
// ============================================================
// TrainingRun Concept Implementation
//
// Manages fine-tuning job lifecycle: dataset preparation,
// hyperparameter configuration, training execution, checkpoint
// management, evaluation, and model export. Supports both full
// fine-tuning and parameter-efficient methods (via sync to Adapter).
// Tracks cost and resource usage. Annotated @gate for async completion.
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, find, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let _runCounter = 0;
function generateRunId(): string {
  return `trun-${Date.now()}-${++_runCounter}`;
}

const _trainingRunHandler: FunctionalConceptHandler = {
  create(input: Record<string, unknown>) {
    const name = input.name as string;
    const baseModel = input.base_model as string;
    const datasetRef = input.dataset_ref as string;
    const hyperparameters = input.hyperparameters as {
      learning_rate: number;
      epochs: number;
      batch_size: number;
      warmup_steps: number;
    };

    if (!name || name.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'name is required' }) as StorageProgram<Result>;
    }
    if (!baseModel || baseModel.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'Missing parameters: base_model' }) as StorageProgram<Result>;
    }
    if (!datasetRef || datasetRef.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'Missing parameters: dataset_ref' }) as StorageProgram<Result>;
    }

    const id = generateRunId();
    let p = createProgram();
    p = put(p, 'runs', id, {
      id,
      name,
      base_model: baseModel,
      dataset_ref: datasetRef,
      hyperparameters,
      status: 'created',
      checkpoints: [],
      evaluation_scores: [],
      cost: 0,
      duration_ms: 0,
      current_epoch: 0,
      current_loss: 0,
      start_time: null,
    });

    return complete(p, 'ok', { run: id }) as StorageProgram<Result>;
  },

  start(input: Record<string, unknown>) {
    const runId = input.run as string;

    let p = createProgram();
    p = get(p, 'runs', runId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'error', { message: 'Training infrastructure unavailable' }),
      (() => {
        let b = createProgram();
        b = get(b, 'runs', runId, 'existing');
        b = mapBindings(b, (bindings) => {
          const run = bindings.existing as Record<string, unknown>;
          return run.status as string;
        }, 'currentStatus');

        return branch(b,
          (bindings) => {
            const status = bindings.currentStatus as string;
            return status !== 'created' && status !== 'paused';
          },
          complete(createProgram(), 'error', { message: 'Run cannot be started from current status' }),
          (() => {
            let s = createProgram();
            s = get(s, 'runs', runId, 'existing');

            // Generate initial checkpoint for epoch 0
            s = putFrom(s, 'runs', runId, (bindings) => {
              const existing = bindings.existing as Record<string, unknown>;
              const hp = existing.hyperparameters as { epochs: number };
              const checkpoints = [...(existing.checkpoints as Record<string, unknown>[])];

              // Stub: create checkpoints for each epoch
              for (let epoch = 1; epoch <= hp.epochs; epoch++) {
                checkpoints.push({
                  epoch,
                  loss: Math.max(0.1, 2.0 - epoch * 0.5),
                  path: `/checkpoints/${runId}/epoch-${epoch}`,
                  timestamp: new Date().toISOString(),
                });
              }

              return {
                ...existing,
                status: 'training',
                checkpoints,
                start_time: new Date().toISOString(),
                current_epoch: hp.epochs,
                current_loss: checkpoints[checkpoints.length - 1]?.loss ?? 0,
                cost: hp.epochs * 0.5, // stub cost
                duration_ms: hp.epochs * 1000, // stub duration
              };
            });

            return complete(s, 'ok', { run: runId });
          })(),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  pause(input: Record<string, unknown>) {
    const runId = input.run as string;

    let p = createProgram();
    p = get(p, 'runs', runId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'not_running', { message: 'Run not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'runs', runId, 'existing');
        b = mapBindings(b, (bindings) => {
          const run = bindings.existing as Record<string, unknown>;
          return run.status as string;
        }, 'currentStatus');

        return branch(b,
          (bindings) => (bindings.currentStatus as string) !== 'training',
          complete(createProgram(), 'not_running', { message: 'Run is not in "training" status' }),
          (() => {
            let u = createProgram();
            u = get(u, 'runs', runId, 'existing');
            u = putFrom(u, 'runs', runId, (bindings) => {
              const existing = bindings.existing as Record<string, unknown>;
              return { ...existing, status: 'paused' };
            });
            u = mapBindings(u, (bindings) => {
              const run = bindings.existing as Record<string, unknown>;
              const checkpoints = run.checkpoints as { path: string }[];
              return checkpoints.length > 0 ? checkpoints[checkpoints.length - 1].path : '';
            }, 'lastCheckpoint');

            return completeFrom(u, 'ok', (bindings) => ({
              run: runId,
              checkpoint: bindings.lastCheckpoint as string,
            }));
          })(),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  resume(input: Record<string, unknown>) {
    const runId = input.run as string;

    let p = createProgram();
    p = get(p, 'runs', runId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'not_paused', { message: 'Run not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'runs', runId, 'existing');
        b = mapBindings(b, (bindings) => {
          const run = bindings.existing as Record<string, unknown>;
          return run.status as string;
        }, 'currentStatus');

        return branch(b,
          (bindings) => (bindings.currentStatus as string) !== 'paused',
          complete(createProgram(), 'not_paused', { message: 'Run is not paused' }),
          (() => {
            let u = createProgram();
            u = get(u, 'runs', runId, 'existing');
            u = putFrom(u, 'runs', runId, (bindings) => {
              const existing = bindings.existing as Record<string, unknown>;
              return { ...existing, status: 'training' };
            });
            return complete(u, 'ok', { run: runId });
          })(),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  evaluate(input: Record<string, unknown>) {
    const runId = input.run as string;
    const datasetRef = input.dataset_ref as string;

    let p = createProgram();
    p = get(p, 'runs', runId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'not_ready', { message: 'No checkpoint available yet' }),
      (() => {
        let b = createProgram();
        b = get(b, 'runs', runId, 'existing');
        b = mapBindings(b, (bindings) => {
          const run = bindings.existing as Record<string, unknown>;
          const checkpoints = run.checkpoints as unknown[];
          return checkpoints.length > 0;
        }, 'hasCheckpoints');

        return branch(b,
          (bindings) => !(bindings.hasCheckpoints as boolean),
          complete(createProgram(), 'not_ready', { message: 'No checkpoint available yet' }),
          (() => {
            let e = createProgram();
            e = get(e, 'runs', runId, 'existing');

            // Stub: generate evaluation scores
            const scores = [
              { metric: 'accuracy', score: 0.82 + Math.random() * 0.1 },
              { metric: 'perplexity', score: 15.0 + Math.random() * 5 },
              { metric: 'SemanticF1', score: 0.75 + Math.random() * 0.15 },
            ];

            e = putFrom(e, 'runs', runId, (bindings) => {
              const existing = bindings.existing as Record<string, unknown>;
              return { ...existing, evaluation_scores: scores };
            });

            return complete(e, 'ok', { scores });
          })(),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  export(input: Record<string, unknown>) {
    const runId = input.run as string;
    const format = input.format as string;

    let p = createProgram();
    p = get(p, 'runs', runId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'not_complete', { message: 'Training not finished' }),
      (() => {
        let b = createProgram();
        b = get(b, 'runs', runId, 'existing');
        b = mapBindings(b, (bindings) => {
          const run = bindings.existing as Record<string, unknown>;
          const status = run.status as string;
          const checkpoints = run.checkpoints as unknown[];
          return status === 'training' || status === 'paused' ? checkpoints.length > 0 : false;
        }, 'canExport');

        return branch(b,
          (bindings) => {
            let ready = false;
            const cb = bindings.canExport;
            // Check if we have checkpoints (trained state)
            return !cb;
          },
          complete(createProgram(), 'not_complete', { message: 'Training not finished' }),
          (() => {
            const ext = format === 'safetensors' ? 'safetensors' : format === 'gguf' ? 'gguf' : 'bin';
            const artifactPath = `/exports/${runId}/model.${ext}`;
            const modelId = `ft-${runId}`;
            return complete(createProgram(), 'ok', { artifact_path: artifactPath, model_id: modelId });
          })(),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  cancel(input: Record<string, unknown>) {
    const runId = input.run as string;

    let p = createProgram();
    p = get(p, 'runs', runId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'not_running', { message: 'Run not active' }),
      (() => {
        let b = createProgram();
        b = get(b, 'runs', runId, 'existing');
        b = mapBindings(b, (bindings) => {
          const run = bindings.existing as Record<string, unknown>;
          const status = run.status as string;
          return status === 'training' || status === 'paused' || status === 'created';
        }, 'canCancel');

        return branch(b,
          (bindings) => !(bindings.canCancel as boolean),
          complete(createProgram(), 'not_running', { message: 'Run not active' }),
          (() => {
            let u = createProgram();
            u = get(u, 'runs', runId, 'existing');
            u = putFrom(u, 'runs', runId, (bindings) => {
              const existing = bindings.existing as Record<string, unknown>;
              return { ...existing, status: 'cancelled' };
            });
            return complete(u, 'ok', { run: runId });
          })(),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  getStatus(input: Record<string, unknown>) {
    const runId = input.run as string;

    let p = createProgram();
    p = get(p, 'runs', runId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Run not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'runs', runId, 'existing');

        return completeFrom(b, 'ok', (bindings) => {
          const run = bindings.existing as Record<string, unknown>;
          const hp = run.hyperparameters as { epochs: number };
          return {
            status: run.status as string,
            current_epoch: run.current_epoch as number,
            total_epochs: hp.epochs,
            current_loss: run.current_loss as number,
            elapsed_ms: run.duration_ms as number,
            cost: run.cost as number,
          };
        });
      })(),
    ) as StorageProgram<Result>;
  },
};

export const trainingRunHandler = autoInterpret(_trainingRunHandler);
