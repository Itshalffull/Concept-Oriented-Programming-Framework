// @clef-handler style=functional
// BackgroundWorker Concept Implementation
// Service worker lifecycle for browser extensions. Gate concept because
// the browser can terminate and restart workers at any time.
// Manages alarm scheduling, idle state, and persistent state across worker restarts.
// See Architecture doc for concept spec details.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `bg-worker-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  // register() with extensionId/scriptUrl args = spec register action
  // register() with no args = concept name registration
  register(input: Record<string, unknown>) {
    if (!input.extensionId && !input.scriptUrl) {
      return complete(createProgram(), 'ok', { name: 'BackgroundWorker' }) as StorageProgram<Result>;
    }

    const extensionId = input.extensionId as string;
    const scriptUrl = input.scriptUrl as string;

    if (!extensionId || extensionId.trim() === '') {
      return complete(createProgram(), 'error', { message: 'extensionId is required' }) as StorageProgram<Result>;
    }
    if (!scriptUrl || scriptUrl.trim() === '') {
      return complete(createProgram(), 'error', { message: 'scriptUrl is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'worker', { extensionId }, 'existing');
    p = mapBindings(p, (b) => ((b.existing as unknown[]) || []).length > 0 ? (b.existing as unknown[])[0] : null, '_found');
    return branch(p, '_found',
      (b) => complete(b, 'ok', { message: 'Worker already registered for this extension.' }),
      (b) => {
        const id = nextId();
        let b2 = put(b, 'worker', id, {
          id, extensionId, scriptUrl,
          status: 'registered',
          alarms: '[]',
          persistedState: '{}',
          lastActive: 0,
        });
        return complete(b2, 'ok', { worker: id });
      },
    ) as StorageProgram<Result>;
  },

  start(input: Record<string, unknown>) {
    const worker = input.worker as string;

    let p = createProgram();
    p = get(p, 'worker', worker, 'record');
    return branch(p, 'record',
      (b) => {
        let b2 = putFrom(b, 'worker', worker, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, status: 'running', lastActive: Date.now() };
        });
        return complete(b2, 'ok', { worker });
      },
      (b) => complete(b, 'notfound', { message: 'No worker with the given identifier.' }),
    ) as StorageProgram<Result>;
  },

  stop(input: Record<string, unknown>) {
    const worker = input.worker as string;

    let p = createProgram();
    p = get(p, 'worker', worker, 'record');
    return branch(p, 'record',
      (b) => {
        let b2 = putFrom(b, 'worker', worker, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, status: 'stopped', lastActive: Date.now() };
        });
        return complete(b2, 'ok', { worker });
      },
      (b) => complete(b, 'notfound', { message: 'No worker with the given identifier.' }),
    ) as StorageProgram<Result>;
  },

  setAlarm(input: Record<string, unknown>) {
    const worker = input.worker as string;
    const name = input.name as string;
    const delayMs = (input.delayMs as number | undefined) ?? 0;
    const periodic = (input.periodic as boolean | undefined) ?? false;

    if (!name || name.trim() === '') {
      return complete(createProgram(), 'error', { message: 'alarm name is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'worker', worker, 'record');
    return branch(p, 'record',
      (b) => {
        let b2 = putFrom(b, 'worker', worker, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          let alarms: Array<{ name: string; delayMs: number; periodic: boolean; scheduledAt: number }> = [];
          try { alarms = JSON.parse(record.alarms as string || '[]'); } catch { alarms = []; }
          // Remove existing alarm with same name, then add
          alarms = alarms.filter((a) => a.name !== name);
          alarms.push({ name, delayMs, periodic, scheduledAt: Date.now() });
          return { ...record, alarms: JSON.stringify(alarms) };
        });
        return complete(b2, 'ok', { worker });
      },
      (b) => complete(b, 'notfound', { message: 'No worker with the given identifier.' }),
    ) as StorageProgram<Result>;
  },

  clearAlarm(input: Record<string, unknown>) {
    const worker = input.worker as string;
    const name = input.name as string;

    if (!name || name.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'No worker or alarm found.' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'worker', worker, 'record');
    return branch(p, 'record',
      (b) => {
        let b2 = putFrom(b, 'worker', worker, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          let alarms: Array<{ name: string }> = [];
          try { alarms = JSON.parse(record.alarms as string || '[]'); } catch { alarms = []; }
          alarms = alarms.filter((a) => a.name !== name);
          return { ...record, alarms: JSON.stringify(alarms) };
        });
        return complete(b2, 'ok', { worker });
      },
      (b) => complete(b, 'notfound', { message: 'No worker or alarm found.' }),
    ) as StorageProgram<Result>;
  },

  onAlarm(input: Record<string, unknown>) {
    const worker = input.worker as string;
    const name = input.name as string;

    if (!name || name.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'No worker or alarm found.' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'worker', worker, 'record');
    return branch(p, 'record',
      (b) => {
        let b2 = putFrom(b, 'worker', worker, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, status: 'running', lastActive: Date.now() };
        });
        return complete(b2, 'ok', { worker });
      },
      (b) => complete(b, 'notfound', { message: 'No worker or alarm found.' }),
    ) as StorageProgram<Result>;
  },

  getStatus(input: Record<string, unknown>) {
    const worker = input.worker as string;

    let p = createProgram();
    p = get(p, 'worker', worker, 'record');
    return branch(p, 'record',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        return {
          status: record.status as string,
          lastActive: record.lastActive as number,
        };
      }),
      (b) => complete(b, 'notfound', { message: 'No worker with the given identifier.' }),
    ) as StorageProgram<Result>;
  },
};

export const backgroundWorkerHandler = autoInterpret(_handler);
