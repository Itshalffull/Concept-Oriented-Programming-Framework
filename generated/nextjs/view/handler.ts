// View — Registration, context-based resolution, state management, and composition
// Manages named views over data sources with filter, sort, group, and layout configuration.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ViewStorage,
  ViewCreateInput,
  ViewCreateOutput,
  ViewSetFilterInput,
  ViewSetFilterOutput,
  ViewSetSortInput,
  ViewSetSortOutput,
  ViewSetGroupInput,
  ViewSetGroupOutput,
  ViewSetVisibleFieldsInput,
  ViewSetVisibleFieldsOutput,
  ViewChangeLayoutInput,
  ViewChangeLayoutOutput,
  ViewDuplicateInput,
  ViewDuplicateOutput,
  ViewEmbedInput,
  ViewEmbedOutput,
} from './types.js';

import {
  createOk,
  createError,
  setFilterOk,
  setFilterNotfound,
  setSortOk,
  setSortNotfound,
  setGroupOk,
  setGroupNotfound,
  setVisibleFieldsOk,
  setVisibleFieldsNotfound,
  changeLayoutOk,
  changeLayoutNotfound,
  duplicateOk,
  duplicateNotfound,
  embedOk,
  embedNotfound,
} from './types.js';

export interface ViewError {
  readonly code: string;
  readonly message: string;
}

export interface ViewHandler {
  readonly create: (
    input: ViewCreateInput,
    storage: ViewStorage,
  ) => TE.TaskEither<ViewError, ViewCreateOutput>;
  readonly setFilter: (
    input: ViewSetFilterInput,
    storage: ViewStorage,
  ) => TE.TaskEither<ViewError, ViewSetFilterOutput>;
  readonly setSort: (
    input: ViewSetSortInput,
    storage: ViewStorage,
  ) => TE.TaskEither<ViewError, ViewSetSortOutput>;
  readonly setGroup: (
    input: ViewSetGroupInput,
    storage: ViewStorage,
  ) => TE.TaskEither<ViewError, ViewSetGroupOutput>;
  readonly setVisibleFields: (
    input: ViewSetVisibleFieldsInput,
    storage: ViewStorage,
  ) => TE.TaskEither<ViewError, ViewSetVisibleFieldsOutput>;
  readonly changeLayout: (
    input: ViewChangeLayoutInput,
    storage: ViewStorage,
  ) => TE.TaskEither<ViewError, ViewChangeLayoutOutput>;
  readonly duplicate: (
    input: ViewDuplicateInput,
    storage: ViewStorage,
  ) => TE.TaskEither<ViewError, ViewDuplicateOutput>;
  readonly embed: (
    input: ViewEmbedInput,
    storage: ViewStorage,
  ) => TE.TaskEither<ViewError, ViewEmbedOutput>;
}

// --- Helpers ---

const toError = (error: unknown): ViewError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const VALID_LAYOUTS: readonly string[] = ['table', 'grid', 'list', 'kanban', 'calendar', 'gallery'];

/** Look up an existing view, returning a notfound variant if absent. */
const withExistingView = <A>(
  viewName: string,
  storage: ViewStorage,
  onNotFound: () => A,
  onFound: (existing: Record<string, unknown>) => Promise<A>,
): TE.TaskEither<ViewError, A> =>
  pipe(
    TE.tryCatch(() => storage.get('view', viewName), toError),
    TE.chain((record) =>
      pipe(
        O.fromNullable(record),
        O.fold(
          () => TE.right(onNotFound()),
          (existing) => TE.tryCatch(() => onFound(existing), toError),
        ),
      ),
    ),
  );

// --- Implementation ---

export const viewHandler: ViewHandler = {
  // Register a new view with its data source and initial layout
  create: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const existing = await storage.get('view', input.view);
          if (existing !== null) {
            return createError(`View '${input.view}' already exists`);
          }
          const layout = VALID_LAYOUTS.includes(input.layout) ? input.layout : 'table';
          await storage.put('view', input.view, {
            view: input.view,
            dataSource: input.dataSource,
            layout,
            filter: null,
            sort: null,
            group: null,
            fields: null,
            createdAt: new Date().toISOString(),
          });
          return createOk(input.view);
        },
        toError,
      ),
    ),

  // Attach a filter expression to a view, auto-creating it if it doesn't exist
  setFilter: (input, storage) =>
    pipe(
      TE.tryCatch(() => storage.get('view', input.view), toError),
      TE.chain((record) => {
        if (record !== null) {
          return TE.tryCatch(async () => {
            await storage.put('view', input.view, { ...record, filter: input.filter });
            return setFilterOk(input.view) as ViewSetFilterOutput;
          }, toError);
        }
        // Auto-create the view with the filter
        return TE.tryCatch(async () => {
          await storage.put('view', input.view, {
            view: input.view,
            dataSource: '',
            layout: 'table',
            filter: input.filter,
            sort: null,
            group: null,
            fields: null,
            createdAt: new Date().toISOString(),
          });
          return setFilterOk(input.view) as ViewSetFilterOutput;
        }, toError);
      }),
    ),

  // Set the sort order on an existing view
  setSort: (input, storage) =>
    withExistingView(
      input.view,
      storage,
      () => setSortNotfound(`View '${input.view}' not found`) as ViewSetSortOutput,
      async (existing) => {
        await storage.put('view', input.view, { ...existing, sort: input.sort });
        return setSortOk(input.view);
      },
    ),

  // Set the grouping dimension on an existing view
  setGroup: (input, storage) =>
    withExistingView(
      input.view,
      storage,
      () => setGroupNotfound(`View '${input.view}' not found`) as ViewSetGroupOutput,
      async (existing) => {
        await storage.put('view', input.view, { ...existing, group: input.group });
        return setGroupOk(input.view);
      },
    ),

  // Restrict which fields are visible in the view
  setVisibleFields: (input, storage) =>
    withExistingView(
      input.view,
      storage,
      () => setVisibleFieldsNotfound(`View '${input.view}' not found`) as ViewSetVisibleFieldsOutput,
      async (existing) => {
        await storage.put('view', input.view, { ...existing, fields: input.fields });
        return setVisibleFieldsOk(input.view);
      },
    ),

  // Change the layout type (table, grid, kanban, etc.) on a view, auto-creating if needed
  changeLayout: (input, storage) =>
    pipe(
      TE.tryCatch(() => storage.get('view', input.view), toError),
      TE.chain((record) => {
        const layout = input.layout;
        if (record !== null) {
          return TE.tryCatch(async () => {
            await storage.put('view', input.view, { ...record, layout });
            return changeLayoutOk(input.view) as ViewChangeLayoutOutput;
          }, toError);
        }
        // Auto-create
        return TE.tryCatch(async () => {
          await storage.put('view', input.view, {
            view: input.view,
            dataSource: '',
            layout,
            filter: null,
            sort: null,
            group: null,
            fields: null,
            createdAt: new Date().toISOString(),
          });
          return changeLayoutOk(input.view) as ViewChangeLayoutOutput;
        }, toError);
      }),
    ),

  // Duplicate an existing view under a new auto-generated name
  duplicate: (input, storage) =>
    withExistingView(
      input.view,
      storage,
      () => duplicateNotfound(`View '${input.view}' not found`) as ViewDuplicateOutput,
      async (existing) => {
        const newName = `${input.view}-copy-${Date.now()}`;
        await storage.put('view', newName, {
          ...existing,
          view: newName,
          createdAt: new Date().toISOString(),
        });
        return duplicateOk(newName);
      },
    ),

  // Generate an embeddable code snippet for a view
  embed: (input, storage) =>
    withExistingView(
      input.view,
      storage,
      () => embedNotfound(`View '${input.view}' not found`) as ViewEmbedOutput,
      async (existing) => {
        const layout = String(existing['layout'] ?? 'table');
        const dataSource = String(existing['dataSource'] ?? '');
        const embedCode = `<clef-view name="${input.view}" layout="${layout}" data-source="${dataSource}" />`;
        return embedOk(embedCode);
      },
    ),
};
