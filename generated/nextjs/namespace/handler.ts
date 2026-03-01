// Namespace — handler.ts
// Hierarchical namespace management: create namespaced nodes with dot-separated paths,
// resolve qualified names, enforce uniqueness within scope, support tree traversal and moves.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  NamespaceStorage,
  NamespaceCreateNamespacedPageInput,
  NamespaceCreateNamespacedPageOutput,
  NamespaceGetChildrenInput,
  NamespaceGetChildrenOutput,
  NamespaceGetHierarchyInput,
  NamespaceGetHierarchyOutput,
  NamespaceMoveInput,
  NamespaceMoveOutput,
} from './types.js';

import {
  createNamespacedPageOk,
  createNamespacedPageExists,
  getChildrenOk,
  getChildrenNotfound,
  getHierarchyOk,
  getHierarchyNotfound,
  moveOk,
  moveNotfound,
} from './types.js';

export interface NamespaceError {
  readonly code: string;
  readonly message: string;
}

export interface NamespaceHandler {
  readonly createNamespacedPage: (
    input: NamespaceCreateNamespacedPageInput,
    storage: NamespaceStorage,
  ) => TE.TaskEither<NamespaceError, NamespaceCreateNamespacedPageOutput>;
  readonly getChildren: (
    input: NamespaceGetChildrenInput,
    storage: NamespaceStorage,
  ) => TE.TaskEither<NamespaceError, NamespaceGetChildrenOutput>;
  readonly getHierarchy: (
    input: NamespaceGetHierarchyInput,
    storage: NamespaceStorage,
  ) => TE.TaskEither<NamespaceError, NamespaceGetHierarchyOutput>;
  readonly move: (
    input: NamespaceMoveInput,
    storage: NamespaceStorage,
  ) => TE.TaskEither<NamespaceError, NamespaceMoveOutput>;
}

const toError = (error: unknown): NamespaceError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const computeQualifiedName = (path: string, node: string): string =>
  path.length > 0 ? `${path}.${node}` : node;

const computeParentPath = (qualifiedName: string): string => {
  const segments = qualifiedName.split('.');
  return segments.slice(0, -1).join('.');
};

// --- Implementation ---

export const namespaceHandler: NamespaceHandler = {
  createNamespacedPage: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => {
          const qualifiedName = computeQualifiedName(input.path, input.node);
          return storage.get('namespaces', qualifiedName);
        },
        toError,
      ),
      TE.chain((existing) => {
        const qualifiedName = computeQualifiedName(input.path, input.node);
        return pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  await storage.put('namespaces', qualifiedName, {
                    node: input.node,
                    path: input.path,
                    qualifiedName,
                    parentPath: input.path,
                    createdAt: new Date().toISOString(),
                  });
                  return createNamespacedPageOk();
                },
                toError,
              ),
            () => TE.right(createNamespacedPageExists(
              `Namespace node '${qualifiedName}' already exists`,
            )),
          ),
        );
      }),
    ),

  getChildren: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('namespaces', input.node),
        toError,
      ),
      TE.chain((nodeRecord) =>
        pipe(
          O.fromNullable(nodeRecord),
          O.fold(
            () => TE.right(getChildrenNotfound(`Namespace '${input.node}' not found`)),
            () =>
              TE.tryCatch(
                async () => {
                  const allNodes = await storage.find('namespaces', { parentPath: input.node });
                  const children = allNodes.map((n) => (n as any).qualifiedName as string);
                  return getChildrenOk(JSON.stringify(children));
                },
                toError,
              ),
          ),
        ),
      ),
    ),

  getHierarchy: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('namespaces', input.node),
        toError,
      ),
      TE.chain((nodeRecord) =>
        pipe(
          O.fromNullable(nodeRecord),
          O.fold(
            () => TE.right(getHierarchyNotfound(`Namespace '${input.node}' not found`)),
            (found) =>
              TE.tryCatch(
                async () => {
                  const ancestors: string[] = [];
                  let currentPath = (found as any).parentPath as string;
                  while (currentPath && currentPath.length > 0) {
                    ancestors.push(currentPath);
                    currentPath = computeParentPath(currentPath);
                  }
                  const hierarchy = {
                    node: input.node,
                    ancestors: ancestors.reverse(),
                  };
                  return getHierarchyOk(JSON.stringify(hierarchy));
                },
                toError,
              ),
          ),
        ),
      ),
    ),

  move: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('namespaces', input.node),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(moveNotfound(`Namespace '${input.node}' not found`)),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const nodeName = (existing as any).node as string;
                  const newQualified = computeQualifiedName(input.newPath, nodeName);

                  // Remove from old location
                  await storage.delete('namespaces', input.node);

                  // Create at new location
                  await storage.put('namespaces', newQualified, {
                    ...existing,
                    path: input.newPath,
                    qualifiedName: newQualified,
                    parentPath: input.newPath,
                    movedAt: new Date().toISOString(),
                  });

                  // Reparent direct children from old qualified name
                  const children = await storage.find('namespaces', { parentPath: input.node });
                  for (const child of children) {
                    const childName = (child as any).node as string;
                    const oldChildQN = (child as any).qualifiedName as string;
                    const newChildQN = computeQualifiedName(newQualified, childName);
                    await storage.delete('namespaces', oldChildQN);
                    await storage.put('namespaces', newChildQN, {
                      ...child,
                      parentPath: newQualified,
                      qualifiedName: newChildQN,
                    });
                  }

                  return moveOk();
                },
                toError,
              ),
          ),
        ),
      ),
    ),
};
