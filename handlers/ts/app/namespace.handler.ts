// @migrated dsl-constructs 2026-03-18
// Namespace Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { wrapFunctional } from '../../../runtime/functional-compat.ts';

const namespaceHandlerFunctional: FunctionalConceptHandler = {
  createNamespacedPage(input: Record<string, unknown>) {
    const node = input.node as string;
    const path = input.path as string;

    let p = createProgram();
    p = spGet(p, 'namespace', node, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'exists', { message: 'A node already exists at this path' }),
      (b) => {
        const segments = path.split('/');
        const parentPath = segments.length > 1
          ? segments.slice(0, -1).join('/')
          : '';

        let b2 = put(b, 'namespace', node, {
          node,
          path,
          separator: '/',
          parent: parentPath,
          createdAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', {});
      },
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  getChildren(input: Record<string, unknown>) {
    const node = input.node as string;

    let p = createProgram();
    p = spGet(p, 'namespace', node, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = find(b, 'namespace', {}, 'allNodes');
        return complete(b2, 'ok', { children: '' });
      },
      (b) => complete(b, 'notfound', { message: 'Node does not exist' }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  getHierarchy(input: Record<string, unknown>) {
    const node = input.node as string;

    let p = createProgram();
    p = spGet(p, 'namespace', node, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = find(b, 'namespace', {}, 'allNodes');
        return complete(b2, 'ok', { hierarchy: JSON.stringify([node]) });
      },
      (b) => complete(b, 'notfound', { message: 'Node does not exist' }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  move(input: Record<string, unknown>) {
    const node = input.node as string;
    const newPath = input.newPath as string;

    let p = createProgram();
    p = spGet(p, 'namespace', node, 'existing');
    p = branch(p, 'existing',
      (b) => {
        const segments = newPath.split('/');
        const parentPath = segments.length > 1
          ? segments.slice(0, -1).join('/')
          : '';

        let b2 = put(b, 'namespace', node, {
          path: newPath,
          parent: parentPath,
        });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: 'Node does not exist' }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

/** Backward-compatible imperative wrapper — delegates to interpret(). */
export const namespaceHandler = wrapFunctional(namespaceHandlerFunctional);
/** The raw functional handler returning StorageProgram. */
export { namespaceHandlerFunctional };
