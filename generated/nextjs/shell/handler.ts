// Shell — handler.ts
// UI shell layout manager with named zones and overlay stack.
// Uses fp-ts for purely functional, composable concept implementations.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ShellStorage,
  ShellInitializeInput,
  ShellInitializeOutput,
  ShellAssignToZoneInput,
  ShellAssignToZoneOutput,
  ShellClearZoneInput,
  ShellClearZoneOutput,
  ShellPushOverlayInput,
  ShellPushOverlayOutput,
  ShellPopOverlayInput,
  ShellPopOverlayOutput,
} from './types.js';

import {
  initializeOk,
  initializeInvalid,
  assignToZoneOk,
  assignToZoneNotfound,
  clearZoneOk,
  clearZoneNotfound,
  pushOverlayOk,
  pushOverlayInvalid,
  popOverlayOk,
  popOverlayEmpty,
} from './types.js';

export interface ShellError {
  readonly code: string;
  readonly message: string;
}

export interface ShellHandler {
  readonly initialize: (
    input: ShellInitializeInput,
    storage: ShellStorage,
  ) => TE.TaskEither<ShellError, ShellInitializeOutput>;
  readonly assignToZone: (
    input: ShellAssignToZoneInput,
    storage: ShellStorage,
  ) => TE.TaskEither<ShellError, ShellAssignToZoneOutput>;
  readonly clearZone: (
    input: ShellClearZoneInput,
    storage: ShellStorage,
  ) => TE.TaskEither<ShellError, ShellClearZoneOutput>;
  readonly pushOverlay: (
    input: ShellPushOverlayInput,
    storage: ShellStorage,
  ) => TE.TaskEither<ShellError, ShellPushOverlayOutput>;
  readonly popOverlay: (
    input: ShellPopOverlayInput,
    storage: ShellStorage,
  ) => TE.TaskEither<ShellError, ShellPopOverlayOutput>;
}

// --- Helpers ---

const storageError = (error: unknown): ShellError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const shellHandler: ShellHandler = {
  // Initialize a shell with a set of named zones. Validates that zone names
  // are provided as a comma-separated list and none are empty.
  initialize: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const zoneList = input.zones.split(',').map((z) => z.trim()).filter((z) => z.length > 0);
          if (zoneList.length === 0) {
            return initializeInvalid('Shell must define at least one zone');
          }
          const zoneAssignments: Record<string, string | null> = {};
          for (const zone of zoneList) {
            zoneAssignments[zone] = null;
          }
          await storage.put('shell', input.shell, {
            shell: input.shell,
            zones: zoneList,
            zoneAssignments,
            overlayStack: [],
            createdAt: new Date().toISOString(),
          });
          return initializeOk(input.shell);
        },
        storageError,
      ),
    ),

  // Assign a content reference to a named zone within the shell.
  // Verifies both the shell and the target zone exist.
  assignToZone: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('shell', input.shell),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(assignToZoneNotfound(`Shell '${input.shell}' not found`)),
            (existing) => {
              const zones = (existing as Record<string, unknown>).zones as readonly string[];
              if (!zones.includes(input.zone)) {
                return TE.right(assignToZoneNotfound(`Zone '${input.zone}' not found in shell '${input.shell}'`));
              }
              return TE.tryCatch(
                async () => {
                  const zoneAssignments = { ...((existing as Record<string, unknown>).zoneAssignments as Record<string, string | null>) };
                  zoneAssignments[input.zone] = input.ref;
                  await storage.put('shell', input.shell, {
                    ...existing,
                    zoneAssignments,
                    updatedAt: new Date().toISOString(),
                  });
                  return assignToZoneOk(input.shell);
                },
                storageError,
              );
            },
          ),
        ),
      ),
    ),

  // Clear a zone's content, returning the previous ref if one was assigned.
  clearZone: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('shell', input.shell),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(clearZoneNotfound(`Shell '${input.shell}' not found`)),
            (existing) => {
              const zones = (existing as Record<string, unknown>).zones as readonly string[];
              if (!zones.includes(input.zone)) {
                return TE.right(clearZoneNotfound(`Zone '${input.zone}' not found in shell '${input.shell}'`));
              }
              return TE.tryCatch(
                async () => {
                  const zoneAssignments = { ...((existing as Record<string, unknown>).zoneAssignments as Record<string, string | null>) };
                  const previousRef = zoneAssignments[input.zone];
                  const previous = pipe(
                    O.fromNullable(previousRef),
                  );
                  zoneAssignments[input.zone] = null;
                  await storage.put('shell', input.shell, {
                    ...existing,
                    zoneAssignments,
                    updatedAt: new Date().toISOString(),
                  });
                  return clearZoneOk(input.shell, previous);
                },
                storageError,
              );
            },
          ),
        ),
      ),
    ),

  // Push an overlay (modal, drawer, toast) onto the shell overlay stack.
  // Validates that the shell exists before pushing.
  pushOverlay: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('shell', input.shell),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(pushOverlayInvalid(`Shell '${input.shell}' not found`)),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const overlayStack = [...((existing as Record<string, unknown>).overlayStack as readonly string[] ?? [])];
                  overlayStack.push(input.ref);
                  await storage.put('shell', input.shell, {
                    ...existing,
                    overlayStack,
                    updatedAt: new Date().toISOString(),
                  });
                  return pushOverlayOk(input.shell);
                },
                storageError,
              ),
          ),
        ),
      ),
    ),

  // Pop the topmost overlay from the shell stack.
  // Returns 'empty' if no overlays are on the stack.
  popOverlay: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('shell', input.shell),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(popOverlayEmpty(`Shell '${input.shell}' not found`)),
            (existing) => {
              const overlayStack = [...((existing as Record<string, unknown>).overlayStack as readonly string[] ?? [])];
              if (overlayStack.length === 0) {
                return TE.right(popOverlayEmpty(`No overlays on shell '${input.shell}'`));
              }
              const overlay = overlayStack.pop() as string;
              return TE.tryCatch(
                async () => {
                  await storage.put('shell', input.shell, {
                    ...existing,
                    overlayStack,
                    updatedAt: new Date().toISOString(),
                  });
                  return popOverlayOk(input.shell, overlay);
                },
                storageError,
              );
            },
          ),
        ),
      ),
    ),
};
