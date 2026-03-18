// @migrated dsl-constructs 2026-03-18
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

export const outlineHandler: FunctionalConceptHandler = {
  create(input: Record<string, unknown>) {
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

  indent(input: Record<string, unknown>) {
    const node = input.node as string;

    let p = createProgram();
    p = spGet(p, 'outline', node, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'ok', { node }),
      (b) => complete(b, 'notfound', { message: 'Node not found' }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  outdent(input: Record<string, unknown>) {
    const node = input.node as string;

    let p = createProgram();
    p = spGet(p, 'outline', node, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'ok', { node }),
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
        let b2 = put(b, 'outline', node, { isCollapsed: true });
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
        let b2 = put(b, 'outline', node, { isCollapsed: false });
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
        let b2 = spGet(b, 'outline', newParent, 'newParentRecord');
        b2 = branch(b2, 'newParentRecord',
          (c) => {
            let c2 = put(c, 'outline', node, { parent: newParent });
            return complete(c2, 'ok', { node });
          },
          (c) => complete(c, 'notfound', { message: 'Parent not found' }),
        );
        return b2;
      },
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
};
