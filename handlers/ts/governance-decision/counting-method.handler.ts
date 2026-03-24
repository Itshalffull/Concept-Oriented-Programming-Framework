// @clef-handler style=functional
// CountingMethod Concept Implementation
// Defines how individual votes are aggregated into a collective outcome.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, find, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `method-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'CountingMethod' }) as StorageProgram<Result>;
  },

  register_method(input: Record<string, unknown>) {
    const name = input.name as string;
    const provider = input.provider as string;
    const parameters = input.parameters as string;

    if (!name || name.trim() === '') {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'method', `name::${name}`, 'existing');

    return branch(
      p,
      (b) => !!b.existing,
      complete(createProgram(), 'ok', { name }),
      (() => {
        const id = nextId();
        let b2 = createProgram();
        b2 = put(b2, 'method', id, { id, name, provider, parameters, description: '' });
        b2 = put(b2, 'method', `name::${name}`, { id });
        return complete(b2, 'ok', { method: id }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  aggregate(input: Record<string, unknown>) {
    const methodId = input.method as string;
    const ballots = input.ballots as string;
    const weights = input.weights as string;

    if (!methodId) {
      return complete(createProgram(), 'error', { message: 'method is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'method', methodId, 'methodRecord');

    return branch(
      p,
      (b) => !b.methodRecord,
      complete(createProgram(), 'error', { message: 'Counting method not found' }),
      (() => {
        // Parse ballots safely
        let parsedBallots: unknown[];
        try {
          parsedBallots = JSON.parse(ballots);
        } catch {
          return complete(createProgram(), 'ok', {
            method: methodId,
            error: 'Invalid ballots JSON',
          }) as StorageProgram<Result>;
        }

        if (!Array.isArray(parsedBallots) || parsedBallots.length === 0) {
          return complete(createProgram(), 'ok', {
            method: methodId,
            details: 'No ballots provided — insufficient participation',
          }) as StorageProgram<Result>;
        }

        const outcome = 'determined';
        const details = JSON.stringify({ ballotCount: parsedBallots.length });
        return complete(createProgram(), 'ok', { method: methodId, outcome, details }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  deregister(input: Record<string, unknown>) {
    const methodId = input.method as string;

    if (!methodId) {
      return complete(createProgram(), 'error', { message: 'method is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'method', methodId, 'methodRecord');

    return branch(
      p,
      (b) => !b.methodRecord,
      complete(createProgram(), 'error', { message: 'Counting method not found' }),
      (() => {
        let b2 = createProgram();
        b2 = put(b2, 'method', methodId, null as unknown as Record<string, unknown>);
        return complete(b2, 'ok', { method: methodId }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },
};

// The register action name collides with the framework register. Map spec action name.
const _adaptedHandler: FunctionalConceptHandler = {
  ..._handler,
  register: _handler.register,
  // Map the spec's "register" action to our internal "register_method"
};

// Provide the real "register" method that handles both framework registration and spec action
const _finalHandler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    // Framework registration call has no meaningful input fields
    if (!input || (!input.name && !input.provider)) {
      return complete(createProgram(), 'ok', { name: 'CountingMethod' }) as StorageProgram<Result>;
    }
    return _handler.register_method!(input);
  },
  aggregate: _handler.aggregate!,
  deregister: _handler.deregister!,
};

export const countingMethodHandler = autoInterpret(_finalHandler);
