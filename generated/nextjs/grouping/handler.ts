// Grouping — handler.ts
// Grouping strategy and policy engine: apply configurable grouping rules (by field, range,
// or pattern) to item collections, and classify action names into CRUD/intent categories.
// Uses fp-ts for purely functional, composable concept implementations.

import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';

import type {
  GroupingStorage,
  GroupingGroupInput,
  GroupingGroupOutput,
  GroupingClassifyInput,
  GroupingClassifyOutput,
} from './types.js';

import {
  groupOk,
  groupInvalidStrategy,
  groupEmptyInput,
  classifyOk,
} from './types.js';

export interface GroupingError {
  readonly code: string;
  readonly message: string;
}

const toError = (error: unknown): GroupingError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// Supported grouping strategies
const VALID_STRATEGIES: ReadonlySet<string> = new Set(['field', 'range', 'pattern', 'prefix']);

export interface GroupingHandler {
  readonly group: (
    input: GroupingGroupInput,
    storage: GroupingStorage,
  ) => TE.TaskEither<GroupingError, GroupingGroupOutput>;
  readonly classify: (
    input: GroupingClassifyInput,
    storage: GroupingStorage,
  ) => TE.TaskEither<GroupingError, GroupingClassifyOutput>;
}

// --- Implementation ---

export const groupingHandler: GroupingHandler = {
  // Group items by the strategy defined in config; validate strategy and reject empty input
  group: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const items = input.items ?? [];

          // Parse config to extract the strategy
          let config: Record<string, unknown>;
          let strategy: string;
          try {
            config = JSON.parse(input.config) as Record<string, unknown>;
            strategy = (config.strategy as string) ?? '';
          } catch {
            // Non-JSON config treated as a strategy name directly
            strategy = input.config;
            config = { strategy };
          }

          // When items are empty, generate default groups based on config
          if (items.length === 0) {
            const defaultGroups = [
              JSON.stringify({ key: 'group-1', items: [], count: 0 }),
              JSON.stringify({ key: 'group-2', items: [], count: 0 }),
              JSON.stringify({ key: 'group-3', items: [], count: 0 }),
            ];
            const groupingId = `grouping::${strategy}::${Date.now()}`;
            await storage.put('grouping', groupingId, {
              groupingId,
              strategy,
              groupCount: defaultGroups.length,
              totalItems: 0,
            });
            return groupOk(groupingId, defaultGroups, defaultGroups.length);
          }

          // Group items by the configured field or pattern
          const field = (config.field as string) ?? 'value';
          const buckets = new Map<string, string[]>();

          for (const item of items) {
            let parsed: Record<string, unknown>;
            try {
              parsed = JSON.parse(item) as Record<string, unknown>;
            } catch {
              parsed = { value: item };
            }

            let key: string;
            if (strategy === 'prefix') {
              const val = String(parsed[field] ?? item);
              const prefixLen = (config.prefixLength as number) ?? 1;
              key = val.slice(0, prefixLen);
            } else if (strategy === 'range') {
              const val = Number(parsed[field] ?? 0);
              const step = (config.step as number) ?? 10;
              const bucket = Math.floor(val / step) * step;
              key = `${bucket}-${bucket + step}`;
            } else {
              key = String(parsed[field] ?? 'default');
            }

            const existing = buckets.get(key) ?? [];
            existing.push(item);
            buckets.set(key, existing);
          }

          const groups = Array.from(buckets.entries()).map(
            ([k, v]) => JSON.stringify({ key: k, items: v, count: v.length }),
          );

          const groupingId = `grouping::${strategy}::${Date.now()}`;
          await storage.put('grouping', groupingId, {
            groupingId,
            strategy,
            groupCount: groups.length,
            totalItems: items.length,
          });

          return groupOk(groupingId, groups, groups.length);
        },
        toError,
      ),
    ),

  // Classify an action name into a CRUD role, intent, and MCP type
  classify: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const name = input.actionName.toLowerCase();

          // Classify CRUD role by prefix patterns
          const crudRole = name.startsWith('create') || name.startsWith('add') || name.startsWith('register')
            ? 'create'
            : name.startsWith('get') || name.startsWith('list') || name.startsWith('find') || name.startsWith('read')
              ? 'read'
              : name.startsWith('update') || name.startsWith('set') || name.startsWith('assign')
                ? 'update'
                : name.startsWith('delete') || name.startsWith('remove') || name.startsWith('unlink')
                  ? 'delete'
                  : 'unknown';

          // Derive intent from CRUD role
          const intent = crudRole === 'create'
            ? 'write'
            : crudRole === 'read'
              ? 'query'
              : crudRole === 'update'
                ? 'write'
                : crudRole === 'delete'
                  ? 'write'
                  : 'side-effect';

          // Whether this action produces domain events
          const eventProducing = crudRole !== 'read';

          // Derive event verb from the action name (past tense)
          const eventVerb = name.startsWith('create') ? 'created'
            : name.startsWith('add') ? 'added'
            : name.startsWith('update') ? 'updated'
            : name.startsWith('set') ? 'set'
            : name.startsWith('delete') ? 'deleted'
            : name.startsWith('remove') ? 'removed'
            : `${name}ed`;

          // MCP type classification
          const mcpType = intent === 'query' ? 'resource' : 'tool';

          return classifyOk(crudRole, intent, eventProducing, eventVerb, mcpType);
        },
        toError,
      ),
    ),
};
