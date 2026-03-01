// Canvas — handler.ts
// Free-form 2D spatial layout with positioned nodes, grouping,
// and layer ordering. Node connections delegated to Graph via sync.

import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  CanvasStorage,
  CanvasAddNodeInput,
  CanvasAddNodeOutput,
  CanvasMoveNodeInput,
  CanvasMoveNodeOutput,
  CanvasGroupNodesInput,
  CanvasGroupNodesOutput,
} from './types.js';

import {
  addNodeOk,
  addNodeNotfound,
  moveNodeOk,
  moveNodeNotfound,
  groupNodesOk,
  groupNodesNotfound,
} from './types.js';

export interface CanvasError {
  readonly code: string;
  readonly message: string;
}

export interface CanvasHandler {
  readonly addNode: (
    input: CanvasAddNodeInput,
    storage: CanvasStorage,
  ) => TE.TaskEither<CanvasError, CanvasAddNodeOutput>;
  readonly moveNode: (
    input: CanvasMoveNodeInput,
    storage: CanvasStorage,
  ) => TE.TaskEither<CanvasError, CanvasMoveNodeOutput>;
  readonly groupNodes: (
    input: CanvasGroupNodesInput,
    storage: CanvasStorage,
  ) => TE.TaskEither<CanvasError, CanvasGroupNodesOutput>;
}

// --- Helpers ---

const storageError = (error: unknown): CanvasError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const nowISO = (): string => new Date().toISOString();

// Internal representation of canvas node positions stored as JSON in the
// positions relation. Each node maps to {x, y, zIndex}.
interface NodePosition {
  readonly x: number;
  readonly y: number;
  readonly zIndex: number;
}

const parsePositions = (raw: unknown): Record<string, NodePosition> => {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, NodePosition>;
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    return raw as Record<string, NodePosition>;
  }
  return {};
};

const parseNodes = (raw: unknown): readonly string[] => {
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

const parseGroups = (raw: unknown): Record<string, readonly string[]> => {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, readonly string[]>;
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    return raw as Record<string, readonly string[]>;
  }
  return {};
};

// --- Implementation ---

export const canvasHandler: CanvasHandler = {
  // Places a new content node on the canvas at the specified coordinates.
  // Assigns z-index based on current highest layer + 1.
  addNode: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('canvas', input.canvas),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<CanvasError, CanvasAddNodeOutput>(
              addNodeNotfound(`Canvas ${input.canvas} does not exist`),
            ),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const nodes = parseNodes(existing.nodes);
                  const positions = parsePositions(existing.positions);

                  // Compute next z-index above all existing nodes
                  const maxZ = Object.values(positions).reduce(
                    (max, p) => Math.max(max, p.zIndex),
                    0,
                  );

                  const newPosition: NodePosition = {
                    x: input.x,
                    y: input.y,
                    zIndex: maxZ + 1,
                  };

                  const updatedNodes = [...nodes, input.node];
                  const updatedPositions = {
                    ...positions,
                    [input.node]: newPosition,
                  };

                  const updated = {
                    ...existing,
                    nodes: JSON.stringify(updatedNodes),
                    positions: JSON.stringify(updatedPositions),
                    updatedAt: nowISO(),
                  };
                  await storage.put('canvas', input.canvas, updated);
                  return addNodeOk();
                },
                storageError,
              ),
          ),
        ),
      ),
    ),

  // Repositions an existing node to the given coordinates.
  // Validates both canvas and node existence.
  moveNode: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('canvas', input.canvas),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<CanvasError, CanvasMoveNodeOutput>(
              moveNodeNotfound(`Canvas ${input.canvas} does not exist`),
            ),
            (existing) => {
              const positions = parsePositions(existing.positions);
              const currentPos = positions[input.node];

              if (currentPos === undefined) {
                return TE.right<CanvasError, CanvasMoveNodeOutput>(
                  moveNodeNotfound(`Node ${input.node} not found on canvas ${input.canvas}`),
                );
              }

              return TE.tryCatch(
                async () => {
                  const updatedPositions = {
                    ...positions,
                    [input.node]: {
                      ...currentPos,
                      x: input.x,
                      y: input.y,
                    },
                  };

                  const updated = {
                    ...existing,
                    positions: JSON.stringify(updatedPositions),
                    updatedAt: nowISO(),
                  };
                  await storage.put('canvas', input.canvas, updated);
                  return moveNodeOk();
                },
                storageError,
              );
            },
          ),
        ),
      ),
    ),

  // Combines the specified nodes into a named group.
  // Validates canvas existence and that all specified nodes exist on the canvas.
  groupNodes: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('canvas', input.canvas),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<CanvasError, CanvasGroupNodesOutput>(
              groupNodesNotfound(`Canvas ${input.canvas} does not exist`),
            ),
            (existing) => {
              const canvasNodes = parseNodes(existing.nodes);
              const requestedNodes = input.nodes.split(',').map((n) => n.trim());

              // Validate all requested nodes exist on the canvas
              const missingNodes = requestedNodes.filter(
                (n) => !canvasNodes.includes(n),
              );
              if (missingNodes.length > 0) {
                return TE.right<CanvasError, CanvasGroupNodesOutput>(
                  groupNodesNotfound(
                    `Nodes not found on canvas: ${missingNodes.join(', ')}`,
                  ),
                );
              }

              return TE.tryCatch(
                async () => {
                  const groups = parseGroups(existing.groups);
                  const updatedGroups = {
                    ...groups,
                    [input.group]: requestedNodes,
                  };

                  const updated = {
                    ...existing,
                    groups: JSON.stringify(updatedGroups),
                    updatedAt: nowISO(),
                  };
                  await storage.put('canvas', input.canvas, updated);
                  return groupNodesOk();
                },
                storageError,
              );
            },
          ),
        ),
      ),
    ),
};
