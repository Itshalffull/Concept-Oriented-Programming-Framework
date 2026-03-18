// @migrated dsl-constructs 2026-03-18
// Host Concept Implementation [W]
// Mounts concepts into UI views with lifecycle management, zone placement, and resource tracking.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
import { autoInterpret } from '../../../runtime/functional-compat.ts';
  createProgram, get as spGet, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }

const _hostHandler: FunctionalConceptHandler = {
  mount(input: Record<string, unknown>) {
    const host = input.host as string;
    const concept = input.concept as string;
    const view = input.view as string;
    const level = input.level as string;
    const zone = input.zone as string;

    if (!concept || !view) {
      const p = createProgram();
      return complete(p, 'invalid', { message: 'Both concept and view are required for mounting' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    const id = host || nextId('W');

    let p = createProgram();
    p = put(p, 'host', id, {
      concept,
      view,
      level: level || 'page',
      zone: zone || 'main',
      status: 'mounted',
      binding: '',
      machines: JSON.stringify([]),
      errorInfo: JSON.stringify(null),
    });

    return complete(p, 'ok', { host: id }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  ready(input: Record<string, unknown>) {
    const host = input.host as string;

    let p = createProgram();
    p = spGet(p, 'host', host, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'host', host, { status: 'ready' });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'invalid', { message: `Host "${host}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  trackResource(input: Record<string, unknown>) {
    const host = input.host as string;
    const kind = input.kind as string;
    const ref = input.ref as string;

    let p = createProgram();
    p = spGet(p, 'host', host, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'host', host, { machines: JSON.stringify([{ kind, ref }]) });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: `Host "${host}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  unmount(input: Record<string, unknown>) {
    const host = input.host as string;

    let p = createProgram();
    p = spGet(p, 'host', host, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'host', host, {
          status: 'unmounted',
          binding: '',
          machines: JSON.stringify([]),
          errorInfo: JSON.stringify(null),
        });
        return complete(b2, 'ok', { machines: '[]', binding: '' });
      },
      (b) => complete(b, 'notfound', { message: `Host "${host}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  refresh(input: Record<string, unknown>) {
    const host = input.host as string;

    let p = createProgram();
    p = spGet(p, 'host', host, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'host', host, { status: 'mounted' });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: `Host "${host}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  setError(input: Record<string, unknown>) {
    const host = input.host as string;
    const errorInfo = input.errorInfo as string;

    let p = createProgram();
    p = spGet(p, 'host', host, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'host', host, {
          status: 'error',
          errorInfo: typeof errorInfo === 'string' ? errorInfo : JSON.stringify(errorInfo),
        });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: `Host "${host}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const hostHandler = autoInterpret(_hostHandler);

