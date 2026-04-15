// @clef-handler style=functional
// AgentMemory Concept Implementation
// Persistent, multi-tier memory modeled after cognitive science. Four tiers:
// working memory, episodic, semantic, procedural. The agent actively manages
// its own memory via tool calls — self-editing memory, not passive storage.
// See Architecture doc for concept spec details.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, del, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `agent-memory-${++idCounter}`;
}

const VALID_MEMORY_TYPES = new Set(['working', 'episodic', 'semantic', 'procedural']);

const DEFAULT_WORKING_MEMORY = [
  { label: 'persona', content: '', max_tokens: 500 },
  { label: 'human', content: '', max_tokens: 500 },
  { label: 'task', content: '', max_tokens: 1000 },
  { label: 'context', content: '', max_tokens: 2000 },
];

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'AgentMemory' }) as StorageProgram<Result>;
  },

  remember(input: Record<string, unknown>) {
    const content = input.content as string;
    const memoryType = input.memory_type as string;
    const metadata = input.metadata as string | null;

    if (!content || content.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'content is required' }) as StorageProgram<Result>;
    }
    if (!memoryType || !VALID_MEMORY_TYPES.has(memoryType)) {
      return complete(createProgram(), 'invalid', { message: `Unknown memory type: ${memoryType}. Valid types: working, episodic, semantic, procedural` }) as StorageProgram<Result>;
    }

    const id = nextId();
    const now = new Date().toISOString();

    let p = createProgram();
    p = put(p, 'entry', id, {
      id,
      memory_type: memoryType,
      content,
      embedding: memoryType === 'semantic' ? [] : null,
      timestamp: now,
      metadata: metadata || null,
    });

    return complete(p, 'ok', { entry: id }) as StorageProgram<Result>;
  },

  recall(input: Record<string, unknown>) {
    const query = input.query as string;
    const memoryType = input.memory_type as string;
    const k = input.k as number;

    if (!query || query.trim() === '') {
      return complete(createProgram(), 'ok', { message: 'No matching memories' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'entry', {}, 'allEntries');

    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.allEntries || []) as Array<Record<string, unknown>>;
      const filtered = all.filter(e => e.memory_type === memoryType);
      const queryLower = query.toLowerCase();

      const scored = filtered.map(e => ({
        entry: e.id as string,
        content: e.content as string,
        relevance: (e.content as string).toLowerCase().includes(queryLower) ? 0.9 : 0.1,
        timestamp: e.timestamp as string,
      }));

      scored.sort((a, b) => b.relevance - a.relevance);
      const results = scored.slice(0, k || 5);

      if (results.length === 0) {
        return { message: 'No matching memories' };
      }

      return { memories: results };
    }) as StorageProgram<Result>;
  },

  editWorkingMemory(input: Record<string, unknown>) {
    const label = input.label as string;
    const newContent = input.new_content as string;

    if (!label || label.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'label is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'working_memory', label, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: `Working memory label '${label}' not found` }),
      (() => {
        let b = createProgram();
        b = get(b, 'working_memory', label, 'wmData');
        b = putFrom(b, 'working_memory', label, (bindings) => {
          const data = bindings.wmData as Record<string, unknown>;
          return { ...data, content: newContent };
        });
        return completeFrom(b, 'ok', (bindings) => {
          const data = bindings.wmData as Record<string, unknown>;
          return { previous: data.content as string };
        });
      })(),
    ) as StorageProgram<Result>;
  },

  forget(input: Record<string, unknown>) {
    const entry = input.entry as string;

    if (!entry || (entry as string).trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'entry is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'entry', entry, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Entry not found' }),
      (() => {
        let b = createProgram();
        b = del(b, 'entry', entry);
        return complete(b, 'ok', {});
      })(),
    ) as StorageProgram<Result>;
  },

  consolidate(input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'entry', {}, 'allEntries');

    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.allEntries || []) as Array<Record<string, unknown>>;
      if (all.length === 0) {
        return { message: 'Nothing to consolidate' };
      }

      // Simulated consolidation metrics
      const episodic = all.filter(e => e.memory_type === 'episodic');
      const merged = Math.floor(episodic.length / 3);
      const pruned = Math.floor(all.length / 10);
      const updated = Math.max(1, Math.floor(all.length / 5));

      return { merged, pruned, updated };
    }) as StorageProgram<Result>;
  },

  search(input: Record<string, unknown>) {
    const query = input.query as string;
    const filters = input.filters as Record<string, unknown> | null;

    if (!query || query.trim() === '') {
      return complete(createProgram(), 'ok', { message: 'No results' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'entry', {}, 'allEntries');

    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.allEntries || []) as Array<Record<string, unknown>>;
      const queryLower = query.toLowerCase();

      let filtered = all.filter(e =>
        (e.content as string).toLowerCase().includes(queryLower)
      );

      if (filters) {
        const memType = (filters as Record<string, unknown>).memory_type as string | null;
        if (memType) {
          filtered = filtered.filter(e => e.memory_type === memType);
        }
      }

      if (filtered.length === 0) {
        return { message: 'No results' };
      }

      const results = filtered.map(e => ({
        entry: e.id as string,
        content: e.content as string,
        memory_type: e.memory_type as string,
        relevance: (e.content as string).toLowerCase().includes(queryLower) ? 0.9 : 0.3,
      }));

      return { results };
    }) as StorageProgram<Result>;
  },

  getWorkingMemory(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'working_memory', {}, 'allBlocks');

    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.allBlocks || []) as Array<Record<string, unknown>>;
      const blocks = all.map(b => ({
        label: b.label as string,
        content: b.content as string,
        tokens: Math.ceil((b.content as string).length / 4),
      }));
      return { blocks };
    }) as StorageProgram<Result>;
  },
};

export const agentMemoryHandler = autoInterpret(_handler);
