// Grouping Concept Implementation (Interface Kit)
import type { ConceptHandler } from '@copf/kernel';

/** Classify a single action name by its operational properties. */
function classifyAction(actionName: string): {
  crudRole: string;
  intent: string;
  eventProducing: boolean;
  eventVerb: string;
  mcpType: string;
} {
  const name = actionName.toLowerCase();

  // CRUD role classification
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
    // Non-CRUD actions are side-effecting tools
    intent = 'write';
    eventProducing = true;
    eventVerb = name;
    mcpType = 'tool';
  }

  // Resource template detection: actions with "by" in name suggest parameterized lookup
  if (crudRole === 'read' && name.includes('by')) {
    mcpType = 'resource-template';
  }

  return { crudRole, intent, eventProducing, eventVerb, mcpType };
}

export const groupingHandler: ConceptHandler = {
  async group(input, storage) {
    const items = JSON.parse(input.items as string) as string[];
    const config = input.config as string;

    if (items.length === 0) {
      return { variant: 'emptyInput' };
    }

    // Parse strategy from config (can be a raw strategy name or JSON)
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
      return { variant: 'invalidStrategy', strategy };
    }

    let groups: Array<{ name: string; description: string; members: string[] }>;

    if (strategy === 'per-concept') {
      // Each item gets its own group
      groups = items.map((item) => ({
        name: item,
        description: `Group for ${item}`,
        members: [item],
      }));
    } else if (strategy === 'per-kit') {
      // All items in a single kit group
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
      // custom: single group
      groups = [{ name: 'custom', description: 'Custom grouping', members: [...items] }];
    }

    const groupingId = `grouping-${strategy}-${Date.now()}`;

    await storage.put('grouping', groupingId, {
      groupingId,
      strategy,
      itemCount: items.length,
      entries: JSON.stringify(groups),
    });

    const groupNames = groups.map((g) => g.name);

    return {
      variant: 'ok',
      grouping: groupingId,
      groups: JSON.stringify(groupNames),
      groupCount: groups.length,
    };
  },

  async classify(input, _storage) {
    const actionName = input.actionName as string;
    const result = classifyAction(actionName);

    return {
      variant: 'ok',
      crudRole: result.crudRole,
      intent: result.intent,
      eventProducing: result.eventProducing,
      eventVerb: result.eventVerb,
      mcpType: result.mcpType,
    };
  },
};
