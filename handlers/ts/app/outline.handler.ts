// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, merge, del, branch, complete, completeFrom, find,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _outlineHandler: FunctionalConceptHandler = {
  create(input: Record<string, unknown>) {
    if (!input.node || (typeof input.node === 'string' && (input.node as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'node is required' }) as StorageProgram<Result>;
    }
    const node = input.node as string;
    const parent = (input.parent as string) || '';

    let p = createProgram();
    p = spGet(p, 'outline', node, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'exists', { message: 'already exists' }),
      (b) => {
        const now = new Date().toISOString();
        let b2 = put(b, 'outline', node, {
          node,
          parent,
          children: JSON.stringify([]),
          isCollapsed: false,
          order: 0,
          createdAt: now,
        });
        if (parent) {
          b2 = spGet(b2, 'outline', parent, 'parentRecord');
        }
        return complete(b2, 'ok', { node });
      },
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  /**
   * indent(node) — make node a child of its previous sibling.
   * No-op if no previous sibling exists (at top of parent's children).
   */
  indent(input: Record<string, unknown>) {
    const node = input.node as string;

    let p = createProgram();
    p = spGet(p, 'outline', node, 'existing');
    p = branch(p, 'existing',
      (b) => {
        const rec = (b.bindings as Record<string, unknown> | undefined)?.existing as
          Record<string, unknown> | undefined;
        const parent = String(rec?.parent ?? '');
        // Find all siblings, pick the last one whose order < mine.
        let b2 = find(b, 'outline', { parent }, 'siblings', {
          sort: { field: 'order', order: 'asc' },
        });
        return completeFrom(b2, 'ok', () => ({ node })); // placeholder; real write below
      },
      (b) => complete(b, 'notfound', { message: 'Node not found' }),
    );
    // NOTE: functional-handler style here can't easily do the "pick prev sibling
    // and put new parent" in one program without lens ergonomics we don't have
    // handy. Current implementation is a no-op passthrough; the client will
    // fall back to calling Outline/reparent directly with the prev-sibling id.
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  /**
   * outdent(node) — make node a child of its grandparent.
   * No-op if node is already at the root level.
   */
  outdent(input: Record<string, unknown>) {
    const node = input.node as string;

    let p = createProgram();
    p = spGet(p, 'outline', node, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'ok', { node }),
      (b) => complete(b, 'notfound', { message: 'Node not found' }),
    );
    // Client dispatches Outline/reparent directly — see RecursiveBlockEditor.
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  /**
   * setOrder(node, order) — update a node's order field. Used by client
   * to implement moveUp/moveDown via order-swap with its sibling.
   */
  setOrder(input: Record<string, unknown>) {
    const node = input.node as string;
    const order = typeof input.order === 'number' ? input.order : parseFloat(String(input.order ?? '0')) || 0;
    let p = createProgram();
    p = spGet(p, 'outline', node, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = merge(b, 'outline', node, { order });
        return complete(b2, 'ok', { node });
      },
      (b) => complete(b, 'notfound', { message: 'Node not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  moveUp(input: Record<string, unknown>) {
    const node = input.node as string;

    let p = createProgram();
    p = spGet(p, 'outline', node, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'ok', { node }),
      (b) => complete(b, 'notfound', { message: 'Node not found' }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  moveDown(input: Record<string, unknown>) {
    const node = input.node as string;

    let p = createProgram();
    p = spGet(p, 'outline', node, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'ok', { node }),
      (b) => complete(b, 'notfound', { message: 'Node not found' }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  collapse(input: Record<string, unknown>) {
    const node = input.node as string;

    let p = createProgram();
    p = spGet(p, 'outline', node, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = merge(b, 'outline', node, { isCollapsed: true });
        return complete(b2, 'ok', { node });
      },
      (b) => complete(b, 'notfound', { message: 'Node not found' }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  expand(input: Record<string, unknown>) {
    const node = input.node as string;

    let p = createProgram();
    p = spGet(p, 'outline', node, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = merge(b, 'outline', node, { isCollapsed: false });
        return complete(b2, 'ok', { node });
      },
      (b) => complete(b, 'notfound', { message: 'Node not found' }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  reparent(input: Record<string, unknown>) {
    const node = input.node as string;
    const newParent = input.newParent as string;

    let p = createProgram();
    p = spGet(p, 'outline', node, 'existing');
    p = branch(p, 'existing',
      (b) => {
        // No longer verify the parent has its own outline record — page
        // roots (rootNodeId on a ContentNode that owns a block tree) are
        // legitimate parents but don't themselves have outline entries.
        // merge preserves node/order/children/isCollapsed/createdAt.
        let b2 = merge(b, 'outline', node, { parent: newParent });
        return complete(b2, 'ok', { node });
      },
      (b) => complete(b, 'notfound', { message: 'Node not found' }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  /**
   * getParent(node) — return the parent field of a node's outline record,
   * or 'notfound' if the node has no outline. Used by Shift+Tab outdent.
   */
  getParent(input: Record<string, unknown>) {
    const node = input.node as string;
    let p = createProgram();
    p = spGet(p, 'outline', node, 'existing');
    p = branch(p, 'existing',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const rec = bindings.existing as Record<string, unknown>;
        return { parent: String(rec.parent ?? '') };
      }),
      (b) => complete(b, 'notfound', { message: 'Node not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  getChildren(input: Record<string, unknown>) {
    const node = input.node as string;

    let p = createProgram();
    p = spGet(p, 'outline', node, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'ok', { children: JSON.stringify([]) }),
      (b) => complete(b, 'notfound', { message: 'Node not found' }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  /**
   * delete(node) — remove a node's outline record. Used when merging
   * blocks (Backspace-at-start) or deleting a block wholesale.
   */
  delete(input: Record<string, unknown>) {
    const node = input.node as string;
    let p = createProgram();
    p = spGet(p, 'outline', node, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = del(b, 'outline', node);
        return complete(b2, 'ok', { node });
      },
      (b) => complete(b, 'notfound', { message: 'Node not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  /**
   * children(parent) — return ordered list of child node IDs whose outline
   * record has parent === input.parent. Returns an empty list (not notfound)
   * for pages that have no children yet — the block editor treats empty and
   * missing the same way. Called by RecursiveBlockEditor.loadChildren.
   */
  children(input: Record<string, unknown>) {
    const parent = (input.parent as string) ?? '';

    let p = createProgram();
    p = find(p, 'outline', { parent }, 'rows', {
      sort: { field: 'order', order: 'asc' },
    });
    p = completeFrom(p, 'ok', (bindings) => {
      const rows = (bindings.rows as Record<string, unknown>[] | undefined) ?? [];
      const children = rows.map((r) => String(r.node ?? ''));
      return { children: JSON.stringify(children) };
    });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const outlineHandler = autoInterpret(_outlineHandler);

