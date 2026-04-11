// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Namespace Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _namespaceHandler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const node = input.node as string;
    const path = input.path as string;
    const provider = input.provider as string;

    if (!node || node.trim() === '') {
      return complete(createProgram(), 'error', { message: 'node is required' }) as StorageProgram<Result>;
    }
    if (!path || path.trim() === '') {
      return complete(createProgram(), 'error', { message: 'path is required' }) as StorageProgram<Result>;
    }
    if (!provider || provider.trim() === '') {
      return complete(createProgram(), 'error', { message: 'provider is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    // Check for duplicate path
    p = spGet(p, 'namespace_by_path', path, 'existingByPath');
    p = branch(p, 'existingByPath',
      (b) => complete(b, 'exists', { message: `A node already exists at path: ${path}` }),
      (b) => {
        const segments = path.split('/');
        const parentPath = segments.length > 1
          ? segments.slice(0, -1).join('/')
          : '';

        // Store by node ID
        let b2 = put(b, 'namespace', node, {
          node,
          path,
          provider,
          separator: '/',
          parent: parentPath,
          createdAt: new Date().toISOString(),
        });
        // Store by path for resolve lookups
        b2 = put(b2, 'namespace_by_path', path, {
          node,
          path,
          provider,
        });
        return complete(b2, 'ok', { id: node });
      },
    );

    return p as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const path = input.path as string;

    if (!path || path.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'path is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = spGet(p, 'namespace_by_path', path, 'found');
    p = branch(p, 'found',
      (b) => complete(b, 'ok', {
        node: (b as any).found?.node ?? '',
        provider: (b as any).found?.provider ?? '',
      }),
      (b) => complete(b, 'notfound', { message: `No node at path: ${path}` }),
    );

    return p as StorageProgram<Result>;
  },

  createNamespacedPage(input: Record<string, unknown>) {
    // Backward-compatible alias — delegates to register with provider: "page"
    return _namespaceHandler.register({
      node: input.node,
      path: input.path,
      provider: 'page',
    });
  },

  getChildren(input: Record<string, unknown>) {
    if (!input.node || (typeof input.node === 'string' && (input.node as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'node is required' }) as StorageProgram<Result>;
    }
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
    if (!input.node || (typeof input.node === 'string' && (input.node as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'node is required' }) as StorageProgram<Result>;
    }
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
    if (!input.node || (typeof input.node === 'string' && (input.node as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'node is required' }) as StorageProgram<Result>;
    }
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

export const namespaceHandler = autoInterpret(_namespaceHandler);

