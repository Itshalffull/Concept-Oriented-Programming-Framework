// AnatomyPartEntity — Component part slots (header, body, footer) with role validation
// Registers named anatomy parts for widgets and provides role-based and binding-based lookups.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  AnatomyPartEntityStorage,
  AnatomyPartEntityRegisterInput,
  AnatomyPartEntityRegisterOutput,
  AnatomyPartEntityFindByRoleInput,
  AnatomyPartEntityFindByRoleOutput,
  AnatomyPartEntityFindBoundToFieldInput,
  AnatomyPartEntityFindBoundToFieldOutput,
  AnatomyPartEntityFindBoundToActionInput,
  AnatomyPartEntityFindBoundToActionOutput,
  AnatomyPartEntityGetInput,
  AnatomyPartEntityGetOutput,
} from './types.js';

import {
  registerOk,
  findByRoleOk,
  findBoundToFieldOk,
  findBoundToActionOk,
  getOk,
  getNotfound,
} from './types.js';

export interface AnatomyPartEntityError {
  readonly code: string;
  readonly message: string;
}

export interface AnatomyPartEntityHandler {
  readonly register: (
    input: AnatomyPartEntityRegisterInput,
    storage: AnatomyPartEntityStorage,
  ) => TE.TaskEither<AnatomyPartEntityError, AnatomyPartEntityRegisterOutput>;
  readonly findByRole: (
    input: AnatomyPartEntityFindByRoleInput,
    storage: AnatomyPartEntityStorage,
  ) => TE.TaskEither<AnatomyPartEntityError, AnatomyPartEntityFindByRoleOutput>;
  readonly findBoundToField: (
    input: AnatomyPartEntityFindBoundToFieldInput,
    storage: AnatomyPartEntityStorage,
  ) => TE.TaskEither<AnatomyPartEntityError, AnatomyPartEntityFindBoundToFieldOutput>;
  readonly findBoundToAction: (
    input: AnatomyPartEntityFindBoundToActionInput,
    storage: AnatomyPartEntityStorage,
  ) => TE.TaskEither<AnatomyPartEntityError, AnatomyPartEntityFindBoundToActionOutput>;
  readonly get: (
    input: AnatomyPartEntityGetInput,
    storage: AnatomyPartEntityStorage,
  ) => TE.TaskEither<AnatomyPartEntityError, AnatomyPartEntityGetOutput>;
}

// --- Helpers ---

const toError = (error: unknown): AnatomyPartEntityError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const VALID_ROLES: readonly string[] = [
  'header', 'body', 'footer', 'sidebar', 'overlay',
  'trigger', 'content', 'label', 'icon', 'action',
];

/** Generate a stable part ID from widget name and part name. */
const makePartId = (widget: string, name: string): string =>
  `${widget}::${name}`;

// --- Implementation ---

export const anatomyPartEntityHandler: AnatomyPartEntityHandler = {
  // Register a new anatomy part for a widget with role validation
  register: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const partId = makePartId(input.widget, input.name);
          const semanticRole = VALID_ROLES.includes(input.role) ? input.role : 'content';
          await storage.put('anatomy_part', partId, {
            partId,
            widget: input.widget,
            name: input.name,
            semanticRole,
            required: input.required,
          });
          // Also index by role for fast role-based lookups
          const roleIndex = await storage.get('anatomy_role_index', input.widget) ?? {};
          const existingParts = Array.isArray(roleIndex[semanticRole]) ? roleIndex[semanticRole] as readonly string[] : [];
          await storage.put('anatomy_role_index', input.widget, {
            ...roleIndex,
            [semanticRole]: [...existingParts, partId],
          });
          return registerOk(partId);
        },
        toError,
      ),
    ),

  // Find all parts that match a given semantic role across all widgets
  findByRole: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const allParts = await storage.find('anatomy_part', { semanticRole: input.role });
          const partIds = allParts.map((p) => String(p['partId'] ?? ''));
          return findByRoleOk(JSON.stringify(partIds));
        },
        toError,
      ),
    ),

  // Find parts that are bound to a specific data field
  findBoundToField: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const bindings = await storage.find('anatomy_binding', { field: input.field });
          const partIds = bindings.map((b) => String(b['partId'] ?? ''));
          return findBoundToFieldOk(JSON.stringify(partIds));
        },
        toError,
      ),
    ),

  // Find parts that are bound to a specific action
  findBoundToAction: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const bindings = await storage.find('anatomy_binding', { action: input.action });
          const partIds = bindings.map((b) => String(b['partId'] ?? ''));
          return findBoundToActionOk(JSON.stringify(partIds));
        },
        toError,
      ),
    ),

  // Retrieve a specific anatomy part by its ID
  get: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('anatomy_part', input.part),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(getNotfound() as AnatomyPartEntityGetOutput),
            (found) =>
              TE.right(getOk(
                String(found['partId'] ?? input.part),
                String(found['widget'] ?? ''),
                String(found['name'] ?? ''),
                String(found['semanticRole'] ?? ''),
                String(found['required'] ?? 'false'),
              )),
          ),
        ),
      ),
    ),
};
