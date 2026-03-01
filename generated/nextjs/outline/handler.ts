// Outline — handler.ts
// Hierarchical tree with indentation, collapsing, and zooming.
// Enables outliner-style navigation where any node can become
// the root of a focused view.

import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  OutlineStorage,
  OutlineCreateInput,
  OutlineCreateOutput,
  OutlineIndentInput,
  OutlineIndentOutput,
  OutlineOutdentInput,
  OutlineOutdentOutput,
  OutlineMoveUpInput,
  OutlineMoveUpOutput,
  OutlineMoveDownInput,
  OutlineMoveDownOutput,
  OutlineCollapseInput,
  OutlineCollapseOutput,
  OutlineExpandInput,
  OutlineExpandOutput,
  OutlineReparentInput,
  OutlineReparentOutput,
  OutlineGetChildrenInput,
  OutlineGetChildrenOutput,
} from './types.js';

import {
  createOk,
  createExists,
  indentOk,
  indentNotfound,
  indentInvalid,
  outdentOk,
  outdentNotfound,
  outdentInvalid,
  moveUpOk,
  moveUpNotfound,
  moveDownOk,
  moveDownNotfound,
  collapseOk,
  collapseNotfound,
  expandOk,
  expandNotfound,
  reparentOk,
  reparentNotfound,
  getChildrenOk,
  getChildrenNotfound,
} from './types.js';

export interface OutlineError {
  readonly code: string;
  readonly message: string;
}

export interface OutlineHandler {
  readonly create: (
    input: OutlineCreateInput,
    storage: OutlineStorage,
  ) => TE.TaskEither<OutlineError, OutlineCreateOutput>;
  readonly indent: (
    input: OutlineIndentInput,
    storage: OutlineStorage,
  ) => TE.TaskEither<OutlineError, OutlineIndentOutput>;
  readonly outdent: (
    input: OutlineOutdentInput,
    storage: OutlineStorage,
  ) => TE.TaskEither<OutlineError, OutlineOutdentOutput>;
  readonly moveUp: (
    input: OutlineMoveUpInput,
    storage: OutlineStorage,
  ) => TE.TaskEither<OutlineError, OutlineMoveUpOutput>;
  readonly moveDown: (
    input: OutlineMoveDownInput,
    storage: OutlineStorage,
  ) => TE.TaskEither<OutlineError, OutlineMoveDownOutput>;
  readonly collapse: (
    input: OutlineCollapseInput,
    storage: OutlineStorage,
  ) => TE.TaskEither<OutlineError, OutlineCollapseOutput>;
  readonly expand: (
    input: OutlineExpandInput,
    storage: OutlineStorage,
  ) => TE.TaskEither<OutlineError, OutlineExpandOutput>;
  readonly reparent: (
    input: OutlineReparentInput,
    storage: OutlineStorage,
  ) => TE.TaskEither<OutlineError, OutlineReparentOutput>;
  readonly getChildren: (
    input: OutlineGetChildrenInput,
    storage: OutlineStorage,
  ) => TE.TaskEither<OutlineError, OutlineGetChildrenOutput>;
}

// --- Helpers ---

const storageError = (error: unknown): OutlineError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const nowISO = (): string => new Date().toISOString();

const asString = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const asNumber = (value: unknown): number =>
  typeof value === 'number' ? value : 0;

const parseChildren = (raw: unknown): readonly string[] => {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as string[];
    } catch {
      return [];
    }
  }
  if (Array.isArray(raw)) {
    return raw as string[];
  }
  return [];
};

// Load the children array for a given parent from storage
const loadChildren = async (
  storage: OutlineStorage,
  parentId: string,
): Promise<readonly string[]> => {
  const parentRecord = await storage.get('outline', parentId);
  if (parentRecord === null) return [];
  return parseChildren(parentRecord.children);
};

// Save the children array for a given parent
const saveChildren = async (
  storage: OutlineStorage,
  parentId: string,
  children: readonly string[],
): Promise<void> => {
  const parentRecord = await storage.get('outline', parentId);
  if (parentRecord !== null) {
    await storage.put('outline', parentId, {
      ...parentRecord,
      children: JSON.stringify(children),
      updatedAt: nowISO(),
    });
  }
};

// --- Implementation ---

export const outlineHandler: OutlineHandler = {
  // Add node to the outline. If parent given, set as child.
  // Returns exists if the node identity is already taken.
  create: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('outline', input.node),
        storageError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  const parentId = pipe(
                    input.parent,
                    O.getOrElse(() => '__root__'),
                  );

                  // Determine order among siblings
                  const siblingChildren = await loadChildren(storage, parentId);
                  const order = siblingChildren.length;

                  const record: Record<string, unknown> = {
                    id: input.node,
                    parent: parentId,
                    children: JSON.stringify([]),
                    isCollapsed: false,
                    order,
                    createdAt: nowISO(),
                    updatedAt: nowISO(),
                  };
                  await storage.put('outline', input.node, record);

                  // Add as child of parent
                  const updatedSiblings = [...siblingChildren, input.node];
                  await saveChildren(storage, parentId, updatedSiblings);

                  // Ensure root node exists if this is a root-level node
                  if (parentId === '__root__') {
                    const rootRecord = await storage.get('outline', '__root__');
                    if (rootRecord === null) {
                      await storage.put('outline', '__root__', {
                        id: '__root__',
                        parent: null,
                        children: JSON.stringify(updatedSiblings),
                        isCollapsed: false,
                        order: 0,
                        createdAt: nowISO(),
                        updatedAt: nowISO(),
                      });
                    }
                  }

                  return createOk(input.node);
                },
                storageError,
              ),
            () =>
              TE.right<OutlineError, OutlineCreateOutput>(
                createExists(`Node ${input.node} already exists`),
              ),
          ),
        ),
      ),
    ),

  // Make node a child of its previous sibling.
  // Returns notfound if node does not exist, invalid if no previous sibling.
  indent: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('outline', input.node),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<OutlineError, OutlineIndentOutput>(
              indentNotfound(`Node ${input.node} not found`),
            ),
            (nodeRecord) =>
              TE.tryCatch(
                async () => {
                  const parentId = asString(nodeRecord.parent) || '__root__';
                  const siblings = await loadChildren(storage, parentId);
                  const idx = siblings.indexOf(input.node);

                  if (idx <= 0) {
                    return indentInvalid('No previous sibling to indent under');
                  }

                  const prevSibling = siblings[idx - 1];

                  // Remove from current parent's children
                  const updatedSiblings = siblings.filter((s) => s !== input.node);
                  await saveChildren(storage, parentId, updatedSiblings);

                  // Add as last child of previous sibling
                  const prevChildren = await loadChildren(storage, prevSibling);
                  const newChildren = [...prevChildren, input.node];
                  await saveChildren(storage, prevSibling, newChildren);

                  // Update node's parent and order
                  await storage.put('outline', input.node, {
                    ...nodeRecord,
                    parent: prevSibling,
                    order: newChildren.length - 1,
                    updatedAt: nowISO(),
                  });

                  return indentOk(input.node);
                },
                storageError,
              ),
          ),
        ),
      ),
    ),

  // Move node up one level in the hierarchy.
  // Returns notfound if node does not exist, invalid if already at root.
  outdent: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('outline', input.node),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<OutlineError, OutlineOutdentOutput>(
              outdentNotfound(`Node ${input.node} not found`),
            ),
            (nodeRecord) =>
              TE.tryCatch(
                async () => {
                  const parentId = asString(nodeRecord.parent) || '__root__';

                  if (parentId === '__root__') {
                    return outdentInvalid('Node is already at root level');
                  }

                  const parentRecord = await storage.get('outline', parentId);
                  if (parentRecord === null) {
                    return outdentInvalid('Parent node not found');
                  }

                  const grandparentId = asString(parentRecord.parent) || '__root__';

                  // Remove from parent's children
                  const parentChildren = await loadChildren(storage, parentId);
                  const updatedParentChildren = parentChildren.filter(
                    (c) => c !== input.node,
                  );
                  await saveChildren(storage, parentId, updatedParentChildren);

                  // Add to grandparent's children right after the parent
                  const gpChildren = await loadChildren(storage, grandparentId);
                  const parentIdx = gpChildren.indexOf(parentId);
                  const insertIdx = parentIdx >= 0 ? parentIdx + 1 : gpChildren.length;
                  const updatedGpChildren = [
                    ...gpChildren.slice(0, insertIdx),
                    input.node,
                    ...gpChildren.slice(insertIdx),
                  ];
                  await saveChildren(storage, grandparentId, updatedGpChildren);

                  // Update node's parent
                  await storage.put('outline', input.node, {
                    ...nodeRecord,
                    parent: grandparentId,
                    order: insertIdx,
                    updatedAt: nowISO(),
                  });

                  return outdentOk(input.node);
                },
                storageError,
              ),
          ),
        ),
      ),
    ),

  // Swap node with its previous sibling in the ordering.
  moveUp: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('outline', input.node),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<OutlineError, OutlineMoveUpOutput>(
              moveUpNotfound(`Node ${input.node} not found`),
            ),
            (nodeRecord) =>
              TE.tryCatch(
                async () => {
                  const parentId = asString(nodeRecord.parent) || '__root__';
                  const siblings = [...await loadChildren(storage, parentId)];
                  const idx = siblings.indexOf(input.node);

                  // If already first or not found, no-op but still ok
                  if (idx > 0) {
                    // Swap with previous sibling
                    const temp = siblings[idx - 1];
                    siblings[idx - 1] = input.node;
                    siblings[idx] = temp;
                    await saveChildren(storage, parentId, siblings);

                    // Update order fields
                    await storage.put('outline', input.node, {
                      ...nodeRecord,
                      order: idx - 1,
                      updatedAt: nowISO(),
                    });
                  }

                  return moveUpOk(input.node);
                },
                storageError,
              ),
          ),
        ),
      ),
    ),

  // Swap node with its next sibling in the ordering.
  moveDown: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('outline', input.node),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<OutlineError, OutlineMoveDownOutput>(
              moveDownNotfound(`Node ${input.node} not found`),
            ),
            (nodeRecord) =>
              TE.tryCatch(
                async () => {
                  const parentId = asString(nodeRecord.parent) || '__root__';
                  const siblings = [...await loadChildren(storage, parentId)];
                  const idx = siblings.indexOf(input.node);

                  // If already last or not found, no-op but still ok
                  if (idx >= 0 && idx < siblings.length - 1) {
                    const temp = siblings[idx + 1];
                    siblings[idx + 1] = input.node;
                    siblings[idx] = temp;
                    await saveChildren(storage, parentId, siblings);

                    await storage.put('outline', input.node, {
                      ...nodeRecord,
                      order: idx + 1,
                      updatedAt: nowISO(),
                    });
                  }

                  return moveDownOk(input.node);
                },
                storageError,
              ),
          ),
        ),
      ),
    ),

  // Hide children of this node.
  collapse: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('outline', input.node),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<OutlineError, OutlineCollapseOutput>(
              collapseNotfound(`Node ${input.node} not found`),
            ),
            (existing) =>
              TE.tryCatch(
                async () => {
                  await storage.put('outline', input.node, {
                    ...existing,
                    isCollapsed: true,
                    updatedAt: nowISO(),
                  });
                  return collapseOk(input.node);
                },
                storageError,
              ),
          ),
        ),
      ),
    ),

  // Show children of this node.
  expand: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('outline', input.node),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<OutlineError, OutlineExpandOutput>(
              expandNotfound(`Node ${input.node} not found`),
            ),
            (existing) =>
              TE.tryCatch(
                async () => {
                  await storage.put('outline', input.node, {
                    ...existing,
                    isCollapsed: false,
                    updatedAt: nowISO(),
                  });
                  return expandOk(input.node);
                },
                storageError,
              ),
          ),
        ),
      ),
    ),

  // Move node under a new parent. Validates both node and parent exist.
  reparent: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => Promise.all([
          storage.get('outline', input.node),
          storage.get('outline', input.newParent),
        ]),
        storageError,
      ),
      TE.chain(([nodeRecord, parentRecord]) => {
        if (nodeRecord === null) {
          return TE.right<OutlineError, OutlineReparentOutput>(
            reparentNotfound(`Node ${input.node} not found`),
          );
        }
        if (parentRecord === null) {
          return TE.right<OutlineError, OutlineReparentOutput>(
            reparentNotfound(`Parent ${input.newParent} not found`),
          );
        }

        return TE.tryCatch(
          async () => {
            const oldParentId = asString(nodeRecord.parent) || '__root__';

            // Remove from old parent's children
            const oldSiblings = await loadChildren(storage, oldParentId);
            const updatedOldSiblings = oldSiblings.filter((c) => c !== input.node);
            await saveChildren(storage, oldParentId, updatedOldSiblings);

            // Add to new parent's children
            const newSiblings = await loadChildren(storage, input.newParent);
            const updatedNewSiblings = [...newSiblings, input.node];
            await saveChildren(storage, input.newParent, updatedNewSiblings);

            // Update node's parent reference
            await storage.put('outline', input.node, {
              ...nodeRecord,
              parent: input.newParent,
              order: updatedNewSiblings.length - 1,
              updatedAt: nowISO(),
            });

            return reparentOk(input.node);
          },
          storageError,
        );
      }),
    ),

  // Return ordered list of children as JSON.
  getChildren: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('outline', input.node),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<OutlineError, OutlineGetChildrenOutput>(
              getChildrenNotfound(`Node ${input.node} not found`),
            ),
            (found) => {
              const children = parseChildren(found.children);
              return TE.right<OutlineError, OutlineGetChildrenOutput>(
                getChildrenOk(JSON.stringify(children)),
              );
            },
          ),
        ),
      ),
    ),
};
