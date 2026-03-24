// @clef-handler style=functional
// Blackboard Concept Implementation
// Shared knowledge repository for asynchronous multi-agent collaboration.
// Agents communicate exclusively by reading from and writing to the board.
// Includes conflict resolution for contradictory posts.
// See Architecture doc for concept spec details.
import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(prefix: string = 'blackboard'): string {
  return `${prefix}-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'Blackboard' }) as StorageProgram<Result>;
  },

  create(input: Record<string, unknown>) {
    const entrySchema = input.entry_schema as Array<{ entry_type: string; schema: string }>;

    if (!entrySchema || !Array.isArray(entrySchema) || entrySchema.length === 0) {
      return complete(createProgram(), 'invalid', { message: 'entry_schema is required and must be non-empty' }) as StorageProgram<Result>;
    }

    for (const s of entrySchema) {
      if (!s.entry_type || !s.schema) {
        return complete(createProgram(), 'invalid', { message: 'Each entry_schema item must have entry_type and schema' }) as StorageProgram<Result>;
      }
    }

    const id = nextId();
    let p = createProgram();
    p = put(p, 'board', id, {
      id,
      entries: [],
      entry_schema: entrySchema,
      subscriptions: [],
      access_log: [],
      createdAt: new Date().toISOString(),
    });

    return complete(p, 'ok', { board: id }) as StorageProgram<Result>;
  },

  post(input: Record<string, unknown>) {
    const board = input.board as string;
    const agentId = input.agent_id as string;
    const entryType = input.entry_type as string;
    const content = input.content as string;
    const confidence = input.confidence as number;

    if (!board || (board as string).trim() === '') {
      return complete(createProgram(), 'ok', { errors: [{ path: 'board', message: 'board is required' }] }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'board', board, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'ok', { errors: [{ path: 'board', message: 'Board not found' }] }),
      (() => {
        let b = createProgram();
        b = get(b, 'board', board, 'boardData');

        return branch(b,
          (bindings) => {
            const data = bindings.boardData as Record<string, unknown>;
            const schemas = (data.entry_schema || []) as Array<{ entry_type: string }>;
            return !schemas.some(s => s.entry_type === entryType);
          },
          complete(createProgram(), 'ok', { errors: [{ path: 'entry_type', message: `Unknown entry_type: ${entryType}` }] }),
          (() => {
            const entryId = nextId('entry');
            const now = new Date().toISOString();

            let c = createProgram();
            c = get(c, 'board', board, 'boardData2');
            c = putFrom(c, 'board', board, (bindings) => {
              const data = bindings.boardData2 as Record<string, unknown>;
              const entries = [...((data.entries || []) as Array<Record<string, unknown>>)];
              const accessLog = [...((data.access_log || []) as Array<Record<string, unknown>>)];

              entries.push({
                id: entryId,
                agent_id: agentId,
                entry_type: entryType,
                content,
                confidence: confidence ?? 1.0,
                timestamp: now,
                status: 'active',
              });

              accessLog.push({
                agent_id: agentId,
                action: 'post',
                entry_id: entryId,
                timestamp: now,
              });

              return { ...data, entries, access_log: accessLog };
            });

            return complete(c, 'ok', { entry_id: entryId });
          })(),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  query(input: Record<string, unknown>) {
    const board = input.board as string;
    const entryType = input.entry_type as string | null;
    const filters = input.filters as string | null;

    if (!board || (board as string).trim() === '') {
      return complete(createProgram(), 'ok', { message: 'No matching entries' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'board', board, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'ok', { message: 'Board not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'board', board, 'boardData');

        return completeFrom(b, 'ok', (bindings) => {
          const data = bindings.boardData as Record<string, unknown>;
          let entries = (data.entries || []) as Array<Record<string, unknown>>;

          if (entryType) {
            entries = entries.filter(e => e.entry_type === entryType);
          }

          if (entries.length === 0) {
            return { message: 'No matching entries' };
          }

          return {
            entries: entries.map(e => ({
              id: e.id as string,
              agent_id: e.agent_id as string,
              content: e.content as string,
              confidence: e.confidence as number,
              timestamp: e.timestamp as string,
            })),
          };
        });
      })(),
    ) as StorageProgram<Result>;
  },

  subscribe(input: Record<string, unknown>) {
    const board = input.board as string;
    const agentId = input.agent_id as string;
    const entryTypes = input.entry_types as string[];
    const condition = input.condition as string | null;

    if (!board || (board as string).trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'board is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'board', board, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Board not found' }),
      (() => {
        const subId = nextId('sub');
        let b = createProgram();
        b = get(b, 'board', board, 'boardData');
        b = putFrom(b, 'board', board, (bindings) => {
          const data = bindings.boardData as Record<string, unknown>;
          const subs = [...((data.subscriptions || []) as Array<Record<string, unknown>>)];
          subs.push({
            id: subId,
            agent_id: agentId,
            entry_types: entryTypes || [],
            condition: condition || null,
          });
          return { ...data, subscriptions: subs };
        });
        return complete(b, 'ok', { subscription_id: subId });
      })(),
    ) as StorageProgram<Result>;
  },

  challenge(input: Record<string, unknown>) {
    const board = input.board as string;
    const entryId = input.entry_id as string;
    const challengerAgentId = input.challenger_agent_id as string;
    const counterEvidence = input.counter_evidence as string;

    if (!board || (board as string).trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'board is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'board', board, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Board not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'board', board, 'boardData');

        b = mapBindings(b, (bindings) => {
          const data = bindings.boardData as Record<string, unknown>;
          const entries = (data.entries || []) as Array<Record<string, unknown>>;
          return entries.some(e => e.id === entryId);
        }, '_entryExists');

        return branch(b,
          (bindings) => !bindings._entryExists,
          complete(createProgram(), 'notfound', { message: 'Entry not found' }),
          (() => {
            const challengeEntryId = nextId('challenge');
            const now = new Date().toISOString();

            let c = createProgram();
            c = get(c, 'board', board, 'boardData3');
            c = putFrom(c, 'board', board, (bindings) => {
              const data = bindings.boardData3 as Record<string, unknown>;
              const entries = [...((data.entries || []) as Array<Record<string, unknown>>)];

              // Mark original entry as challenged
              const idx = entries.findIndex(e => e.id === entryId);
              if (idx >= 0) {
                entries[idx] = { ...entries[idx], status: 'challenged' };
              }

              // Add counter-evidence as linked entry
              entries.push({
                id: challengeEntryId,
                agent_id: challengerAgentId,
                entry_type: 'challenge',
                content: counterEvidence,
                confidence: 1.0,
                timestamp: now,
                status: 'active',
                challenges: entryId,
              });

              return { ...data, entries };
            });

            return complete(c, 'ok', { entry_id: challengeEntryId });
          })(),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const board = input.board as string;
    const entryIds = input.entry_ids as string[];
    const strategy = input.strategy as string;

    if (!board || (board as string).trim() === '') {
      return complete(createProgram(), 'ok', { message: 'Cannot resolve automatically' }) as StorageProgram<Result>;
    }

    const validStrategies = new Set(['latest_wins', 'highest_confidence', 'merge', 'escalate_to_consensus']);
    if (!strategy || !validStrategies.has(strategy)) {
      return complete(createProgram(), 'ok', { message: 'Cannot resolve automatically' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'board', board, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'ok', { message: 'Board not found' }),
      (() => {
        const resolvedId = nextId('resolved');
        const now = new Date().toISOString();

        let b = createProgram();
        b = get(b, 'board', board, 'boardData');
        b = putFrom(b, 'board', board, (bindings) => {
          const data = bindings.boardData as Record<string, unknown>;
          const entries = [...((data.entries || []) as Array<Record<string, unknown>>)];

          const relevant = entries.filter(e => entryIds.includes(e.id as string));
          if (relevant.length === 0) {
            return data;
          }

          let resolvedContent: string;
          if (strategy === 'latest_wins') {
            resolvedContent = (relevant[relevant.length - 1].content as string);
          } else if (strategy === 'highest_confidence') {
            relevant.sort((a, b) => (b.confidence as number) - (a.confidence as number));
            resolvedContent = relevant[0].content as string;
          } else {
            resolvedContent = relevant.map(r => r.content as string).join('\n');
          }

          // Mark resolved entries
          for (const id of entryIds) {
            const idx = entries.findIndex(e => e.id === id);
            if (idx >= 0) {
              entries[idx] = { ...entries[idx], status: 'resolved' };
            }
          }

          entries.push({
            id: resolvedId,
            agent_id: 'system',
            entry_type: 'resolution',
            content: resolvedContent,
            confidence: 1.0,
            timestamp: now,
            status: 'active',
            resolves: entryIds,
          });

          return { ...data, entries };
        });

        return complete(b, 'ok', { resolved_entry_id: resolvedId });
      })(),
    ) as StorageProgram<Result>;
  },

  snapshot(input: Record<string, unknown>) {
    const board = input.board as string;

    let p = createProgram();
    p = get(p, 'board', board, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'ok', { state: '{}', entry_count: 0 }),
      (() => {
        let b = createProgram();
        b = get(b, 'board', board, 'boardData');
        return completeFrom(b, 'ok', (bindings) => {
          const data = bindings.boardData as Record<string, unknown>;
          const entries = (data.entries || []) as Array<Record<string, unknown>>;
          return {
            state: JSON.stringify(data),
            entry_count: entries.length,
          };
        });
      })(),
    ) as StorageProgram<Result>;
  },
};

export const blackboardHandler = autoInterpret(_handler);
