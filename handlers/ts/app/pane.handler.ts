// @clef-handler style=functional
// Pane Concept Implementation
// Lightweight content container with a title, lifecycle state, and size
// constraints. Implements open/close/minimize/maximize/restore lifecycle
// plus pin/unpin behavior and sizing constraints.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type R = StorageProgram<{ variant: string; [key: string]: unknown }>;

const _handler: FunctionalConceptHandler = {
  open(input: Record<string, unknown>): R {
    const pane = input.pane as string;
    const title = input.title as string;
    const hostRef = input.hostRef as string;
    const icon = (input.icon as string | null | undefined) ?? null;

    if (!title || title.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'title is required' }) as R;
    }
    if (!hostRef || hostRef.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'hostRef is required' }) as R;
    }

    let p = createProgram();
    p = put(p, 'pane', pane, {
      pane,
      title,
      hostRef,
      icon: icon ?? null,
      status: 'open',
      closable: true,
      pinned: false,
      transient: false,
      minWidth: null,
      minHeight: null,
      preferredWidth: null,
      preferredHeight: null,
    });
    return complete(p, 'ok', { pane }) as R;
  },

  close(input: Record<string, unknown>): R {
    const pane = input.pane as string;

    let p = createProgram();
    p = get(p, 'pane', pane, 'existing');
    return branch(p, 'existing',
      (b) => {
        const record = (b as Record<string, unknown>).existing as Record<string, unknown> | undefined;
        // We need to check pinned via mapBindings + branch
        let b2 = mapBindings(b as StorageProgram<unknown>, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return rec?.pinned === true;
        }, '_pinned');
        return branch(b2, '_pinned',
          (bb) => complete(bb as StorageProgram<unknown>, 'invalid', { message: 'Pane is pinned and cannot be closed' }),
          (bb) => {
            let b3 = putFrom(bb as StorageProgram<unknown>, 'pane', pane, (bindings) => ({
              ...(bindings.existing as Record<string, unknown>),
              status: 'closed',
            }));
            return complete(b3, 'ok', { pane });
          },
        ) as R;
      },
      (b) => complete(b as StorageProgram<unknown>, 'notfound', { message: 'No pane exists with this identifier' }),
    ) as R;
  },

  minimize(input: Record<string, unknown>): R {
    const pane = input.pane as string;

    let p = createProgram();
    p = get(p, 'pane', pane, 'existing');
    return branch(p, 'existing',
      (b) => {
        let b2 = mapBindings(b as StorageProgram<unknown>, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return rec?.status === 'minimized' || rec?.status === 'closed';
        }, '_invalid');
        return branch(b2, '_invalid',
          (bb) => complete(bb as StorageProgram<unknown>, 'invalid', { message: 'Pane is already minimized or is closed' }),
          (bb) => {
            let b3 = putFrom(bb as StorageProgram<unknown>, 'pane', pane, (bindings) => ({
              ...(bindings.existing as Record<string, unknown>),
              status: 'minimized',
            }));
            return complete(b3, 'ok', { pane });
          },
        ) as R;
      },
      (b) => complete(b as StorageProgram<unknown>, 'notfound', { message: 'No pane exists with this identifier' }),
    ) as R;
  },

  maximize(input: Record<string, unknown>): R {
    const pane = input.pane as string;

    let p = createProgram();
    p = get(p, 'pane', pane, 'existing');
    return branch(p, 'existing',
      (b) => {
        let b2 = mapBindings(b as StorageProgram<unknown>, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return rec?.status === 'maximized' || rec?.status === 'closed';
        }, '_invalid');
        return branch(b2, '_invalid',
          (bb) => complete(bb as StorageProgram<unknown>, 'invalid', { message: 'Pane is already maximized or is closed' }),
          (bb) => {
            let b3 = putFrom(bb as StorageProgram<unknown>, 'pane', pane, (bindings) => ({
              ...(bindings.existing as Record<string, unknown>),
              status: 'maximized',
            }));
            return complete(b3, 'ok', { pane });
          },
        ) as R;
      },
      (b) => complete(b as StorageProgram<unknown>, 'notfound', { message: 'No pane exists with this identifier' }),
    ) as R;
  },

  restore(input: Record<string, unknown>): R {
    const pane = input.pane as string;

    let p = createProgram();
    p = get(p, 'pane', pane, 'existing');
    return branch(p, 'existing',
      (b) => {
        let b2 = mapBindings(b as StorageProgram<unknown>, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return rec?.status === 'closed';
        }, '_invalid');
        return branch(b2, '_invalid',
          (bb) => complete(bb as StorageProgram<unknown>, 'invalid', { message: 'Pane is closed and cannot be restored' }),
          (bb) => {
            let b3 = putFrom(bb as StorageProgram<unknown>, 'pane', pane, (bindings) => ({
              ...(bindings.existing as Record<string, unknown>),
              status: 'open',
            }));
            return complete(b3, 'ok', { pane });
          },
        ) as R;
      },
      (b) => complete(b as StorageProgram<unknown>, 'notfound', { message: 'No pane exists with this identifier' }),
    ) as R;
  },

  pin(input: Record<string, unknown>): R {
    const pane = input.pane as string;

    let p = createProgram();
    p = get(p, 'pane', pane, 'existing');
    return branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b as StorageProgram<unknown>, 'pane', pane, (bindings) => ({
          ...(bindings.existing as Record<string, unknown>),
          pinned: true,
        }));
        return complete(b2, 'ok', { pane });
      },
      (b) => complete(b as StorageProgram<unknown>, 'notfound', { message: 'No pane exists with this identifier' }),
    ) as R;
  },

  unpin(input: Record<string, unknown>): R {
    const pane = input.pane as string;

    let p = createProgram();
    p = get(p, 'pane', pane, 'existing');
    return branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b as StorageProgram<unknown>, 'pane', pane, (bindings) => ({
          ...(bindings.existing as Record<string, unknown>),
          pinned: false,
        }));
        return complete(b2, 'ok', { pane });
      },
      (b) => complete(b as StorageProgram<unknown>, 'notfound', { message: 'No pane exists with this identifier' }),
    ) as R;
  },

  setConstraints(input: Record<string, unknown>): R {
    const pane = input.pane as string;
    const minWidth = input.minWidth != null ? (input.minWidth as number) : null;
    const minHeight = input.minHeight != null ? (input.minHeight as number) : null;
    const preferredWidth = input.preferredWidth != null ? (input.preferredWidth as number) : null;
    const preferredHeight = input.preferredHeight != null ? (input.preferredHeight as number) : null;

    // Validate: no negative dimensions
    if (minWidth !== null && minWidth < 0) {
      return complete(createProgram(), 'invalid', { message: 'minWidth must not be negative' }) as R;
    }
    if (minHeight !== null && minHeight < 0) {
      return complete(createProgram(), 'invalid', { message: 'minHeight must not be negative' }) as R;
    }
    if (preferredWidth !== null && preferredWidth < 0) {
      return complete(createProgram(), 'invalid', { message: 'preferredWidth must not be negative' }) as R;
    }
    if (preferredHeight !== null && preferredHeight < 0) {
      return complete(createProgram(), 'invalid', { message: 'preferredHeight must not be negative' }) as R;
    }
    // preferredWidth must be >= minWidth
    if (minWidth !== null && preferredWidth !== null && preferredWidth < minWidth) {
      return complete(createProgram(), 'invalid', { message: 'preferredWidth must not be less than minWidth' }) as R;
    }
    // preferredHeight must be >= minHeight
    if (minHeight !== null && preferredHeight !== null && preferredHeight < minHeight) {
      return complete(createProgram(), 'invalid', { message: 'preferredHeight must not be less than minHeight' }) as R;
    }

    let p = createProgram();
    p = get(p, 'pane', pane, 'existing');
    return branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b as StorageProgram<unknown>, 'pane', pane, (bindings) => ({
          ...(bindings.existing as Record<string, unknown>),
          minWidth,
          minHeight,
          preferredWidth,
          preferredHeight,
        }));
        return complete(b2, 'ok', { pane });
      },
      (b) => complete(b as StorageProgram<unknown>, 'notfound', { message: 'No pane exists with this identifier' }),
    ) as R;
  },

  get(input: Record<string, unknown>): R {
    const pane = input.pane as string;

    let p = createProgram();
    p = get(p, 'pane', pane, 'record');
    return branch(p, 'record',
      (b) => completeFrom(b as StorageProgram<unknown>, 'ok', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        return {
          pane: record.pane as string,
          title: record.title as string,
          hostRef: record.hostRef as string,
          icon: (record.icon as string | null) ?? null,
          status: record.status as string,
          closable: record.closable as boolean,
          pinned: record.pinned as boolean,
          transient: record.transient as boolean,
          minWidth: (record.minWidth as number | null) ?? null,
          minHeight: (record.minHeight as number | null) ?? null,
          preferredWidth: (record.preferredWidth as number | null) ?? null,
          preferredHeight: (record.preferredHeight as number | null) ?? null,
        };
      }),
      (b) => complete(b as StorageProgram<unknown>, 'notfound', { message: 'No pane exists with this identifier' }),
    ) as R;
  },

  list(_input: Record<string, unknown>): R {
    let p = createProgram();
    p = find(p, 'pane', {}, 'all');
    return completeFrom(p, 'ok', (bindings) => ({
      panes: (bindings.all as Array<Record<string, unknown>>).map(r => r.pane as string),
    })) as R;
  },

  register() {
    return complete(createProgram(), 'ok', { name: 'Pane' }) as R;
  },
};

export const paneHandler = autoInterpret(_handler);
