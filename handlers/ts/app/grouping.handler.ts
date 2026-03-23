// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Grouping Concept Implementation (Clef Bind)
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, put, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

/** Classify a single action name by its operational properties. */
function classifyAction(actionName: string): {
  crudRole: string;
  intent: string;
  eventProducing: boolean;
  eventVerb: string;
  mcpType: string;
} {
  const name = actionName.toLowerCase();

  let crudRole = 'other';
  let intent = 'read';
  let eventProducing = false;
  let eventVerb = '';
  let mcpType: string = 'tool';

  if (['create', 'add', 'insert', 'register', 'new'].some((v) => name.startsWith(v))) {
    crudRole = 'create';
    intent = 'write';
    eventProducing = true;
    eventVerb = 'created';
  } else if (['get', 'find', 'list', 'read', 'fetch', 'search', 'resolve', 'query'].some((v) => name.startsWith(v))) {
    crudRole = 'read';
    intent = 'read';
    eventProducing = false;
    eventVerb = '';
    mcpType = 'resource';
  } else if (['update', 'edit', 'modify', 'set', 'change', 'rename', 'patch'].some((v) => name.startsWith(v))) {
    crudRole = 'update';
    intent = 'write';
    eventProducing = true;
    eventVerb = 'updated';
  } else if (['delete', 'remove', 'drop', 'purge', 'destroy'].some((v) => name.startsWith(v))) {
    crudRole = 'delete';
    intent = 'write';
    eventProducing = true;
    eventVerb = 'deleted';
  } else {
    intent = 'write';
    eventProducing = true;
    eventVerb = name;
    mcpType = 'tool';
  }

  if (crudRole === 'read' && name.includes('by')) {
    mcpType = 'resource-template';
  }

  return { crudRole, intent, eventProducing, eventVerb, mcpType };
}

/** Parse the items input, which may be an array, a JSON string, or a spec list object. */
function parseItems(raw: unknown): string[] | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) {
    // Already an array — use directly
    return raw.map(String);
  }
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (s === '') return null;
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map(String);
      return null;
    } catch {
      return null;
    }
  }
  // Handle spec list object: { type: "list", items: [...] }
  if (typeof raw === 'object' && (raw as Record<string, unknown>).type === 'list') {
    const listItems = (raw as Record<string, unknown>).items;
    if (Array.isArray(listItems)) {
      return listItems.map((item: unknown) => {
        if (typeof item === 'object' && item !== null) {
          const obj = item as Record<string, unknown>;
          if (obj.type === 'literal' && obj.value !== undefined) return String(obj.value);
        }
        return String(item);
      });
    }
  }
  return null;
}

const _groupingHandler: FunctionalConceptHandler = {
  group(input: Record<string, unknown>) {
    const parsedItems = parseItems(input.items);
    if (parsedItems === null) {
      return complete(createProgram(), 'error', { message: 'items is required' }) as StorageProgram<Result>;
    }
    const items = parsedItems;
    const config = input.config as string;

    if (items.length === 0) {
      const p = createProgram();
      return complete(p, 'emptyInput', {}) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    let strategy: string;
    try {
      const parsed = JSON.parse(config);
      strategy = (parsed.strategy as string) ?? config;
    } catch {
      strategy = config;
    }

    const structuralStrategies = ['per-concept', 'per-kit', 'single', 'custom'];
    const behavioralStrategies = ['by-crud', 'by-intent', 'by-event', 'by-mcp-type'];
    const allStrategies = [...structuralStrategies, ...behavioralStrategies];

    if (!allStrategies.includes(strategy)) {
      const p = createProgram();
      return complete(p, 'invalidStrategy', { strategy }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    let groups: Array<{ name: string; description: string; members: string[] }>;

    if (strategy === 'per-concept') {
      groups = items.map((item) => ({
        name: item,
        description: `Group for ${item}`,
        members: [item],
      }));
    } else if (strategy === 'per-kit') {
      groups = [{ name: 'kit', description: 'All concepts in kit', members: [...items] }];
    } else if (strategy === 'single') {
      groups = [{ name: 'all', description: 'All items', members: [...items] }];
    } else if (strategy === 'by-crud') {
      const buckets: Record<string, string[]> = { create: [], read: [], update: [], delete: [], other: [] };
      for (const item of items) {
        const { crudRole } = classifyAction(item);
        buckets[crudRole].push(item);
      }
      groups = Object.entries(buckets)
        .filter(([, members]) => members.length > 0)
        .map(([name, members]) => ({ name, description: `${name} operations`, members }));
    } else if (strategy === 'by-intent') {
      const buckets: Record<string, string[]> = { read: [], write: [] };
      for (const item of items) {
        const { intent } = classifyAction(item);
        buckets[intent].push(item);
      }
      groups = Object.entries(buckets)
        .filter(([, members]) => members.length > 0)
        .map(([name, members]) => ({ name, description: `${name} intent`, members }));
    } else if (strategy === 'by-event') {
      const producing: string[] = [];
      const nonProducing: string[] = [];
      for (const item of items) {
        const { eventProducing } = classifyAction(item);
        if (eventProducing) {
          producing.push(item);
        } else {
          nonProducing.push(item);
        }
      }
      groups = [];
      if (producing.length > 0) groups.push({ name: 'event-producing', description: 'Side-effecting actions', members: producing });
      if (nonProducing.length > 0) groups.push({ name: 'query', description: 'Pure query actions', members: nonProducing });
    } else if (strategy === 'by-mcp-type') {
      const buckets: Record<string, string[]> = { tool: [], resource: [], 'resource-template': [] };
      for (const item of items) {
        const { mcpType } = classifyAction(item);
        buckets[mcpType].push(item);
      }
      groups = Object.entries(buckets)
        .filter(([, members]) => members.length > 0)
        .map(([name, members]) => ({ name, description: `MCP ${name} type`, members }));
    } else {
      groups = [{ name: 'custom', description: 'Custom grouping', members: [...items] }];
    }

    const groupingId = `grouping-${strategy}-${Date.now()}`;
    const groupNames = groups.map((g) => g.name);

    let p = createProgram();
    p = put(p, 'grouping', groupingId, {
      groupingId,
      strategy,
      itemCount: items.length,
      entries: JSON.stringify(groups),
    });

    return complete(p, 'ok', {
      grouping: groupingId,
      groups: JSON.stringify(groupNames),
      groupCount: groups.length,
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  classify(input: Record<string, unknown>) {
    if (!input.actionName || (typeof input.actionName === 'string' && (input.actionName as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'actionName is required' }) as StorageProgram<Result>;
    }
    const actionName = input.actionName as string;
    const result = classifyAction(actionName);

    const p = createProgram();
    return complete(p, 'ok', {
      crudRole: result.crudRole,
      intent: result.intent,
      eventProducing: result.eventProducing,
      eventVerb: result.eventVerb,
      mcpType: result.mcpType,
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const groupingHandler = autoInterpret(_groupingHandler);

