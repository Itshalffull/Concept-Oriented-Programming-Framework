// @migrated dsl-constructs 2026-03-18
// Binding Concept Implementation [B, C]
// Surface core binding between concepts and UI surfaces with mode-aware synchronization.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }

const VALID_MODES = ['coupled', 'rest', 'graphql', 'static'];

const _bindingHandler: FunctionalConceptHandler = {
  bind(input: Record<string, unknown>) {
    const binding = input.binding as string;
    const concept = input.concept as string;
    const mode = input.mode as string;

    if (!VALID_MODES.includes(mode)) {
      let p = createProgram();
      return complete(p, 'invalid', { message: `Invalid mode "${mode}". Valid modes: ${VALID_MODES.join(', ')}` }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    const id = binding || nextId('B');

    let p = createProgram();
    p = put(p, 'binding', id, {
      concept,
      mode,
      endpoint: '',
      lastSync: '',
      status: 'bound',
      signalMap: JSON.stringify({}),
    });

    return complete(p, 'ok', { binding: id }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  sync(input: Record<string, unknown>) {
    const binding = input.binding as string;

    let p = createProgram();
    p = spGet(p, 'binding', binding, 'existing');
    p = branch(p, 'existing',
      (b) => {
        const now = new Date().toISOString();
        let b2 = put(b, 'binding', binding, { lastSync: now, status: 'synced' });
        return complete(b2, 'ok', { lastSync: now });
      },
      (b) => complete(b, 'error', { message: 'Binding not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  invoke(input: Record<string, unknown>) {
    const binding = input.binding as string;
    const action = input.action as string;
    const actionInput = input.input as string;

    let p = createProgram();
    p = spGet(p, 'binding', binding, 'existing');
    p = branch(p, 'existing',
      (b) => {
        // Status and concept resolved at runtime from bindings
        return complete(b, 'ok', { result: '' });
      },
      (b) => complete(b, 'error', { message: 'Binding not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  unbind(input: Record<string, unknown>) {
    const binding = input.binding as string;

    let p = createProgram();
    p = spGet(p, 'binding', binding, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'binding', binding, { status: 'unbound', lastSync: '' });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: 'Binding not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const bindingHandler = autoInterpret(_bindingHandler);

