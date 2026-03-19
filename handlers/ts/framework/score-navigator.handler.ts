// ScoreNavigator Concept Implementation
//
// Browse Score entities by kind and name, show items with all
// related entities, and traverse relationships to walk the
// Score graph interactively.

import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.js';

// ─── Kind → collection mapping ───────────────────────────

const KIND_COLLECTION: Record<string, string> = {
  concept: 'concepts',
  sync: 'syncs',
  symbol: 'symbols',
  file: 'files',
  handler: 'handlers',
  widget: 'widgetImpls',
  theme: 'themeImpls',
  deployment: 'deployments',
  suite: 'suiteManifests',
  interface: 'interfaces',
};

const VALID_KINDS = Object.keys(KIND_COLLECTION);

// ─── Relationship discovery ──────────────────────────────
// Given an item, find all related items across the Score graph.

interface RelatedGroup {
  relation: string;
  kind: string;
  items: Array<{ name: string; summary: string }>;
}

async function findRelated(
  kind: string,
  item: Record<string, unknown>,
  storage: ConceptStorage,
): Promise<RelatedGroup[]> {
  const groups: RelatedGroup[] = [];

  if (kind === 'concept') {
    const conceptName = item.conceptName as string;

    // Find actions (they're in the concept record)
    const actions = (item.actions as string[]) || [];
    if (actions.length > 0) {
      groups.push({
        relation: 'actions',
        kind: 'action',
        items: actions.map(a => ({ name: a, summary: `${conceptName}/${a}` })),
      });
    }

    // Find state fields
    const fields = (item.stateFields as string[]) || [];
    if (fields.length > 0) {
      groups.push({
        relation: 'stateFields',
        kind: 'field',
        items: fields.map(f => ({ name: f, summary: `${conceptName}.${f}` })),
      });
    }

    // Find syncs that reference this concept
    const allSyncs = await storage.find('syncs');
    const relatedSyncs = allSyncs.filter(s => {
      const triggers = (s.triggers as string[]) || [];
      const effects = (s.effects as string[]) || [];
      return [...triggers, ...effects].some(t =>
        t.toLowerCase().includes(conceptName.toLowerCase()),
      );
    });
    if (relatedSyncs.length > 0) {
      groups.push({
        relation: 'syncs',
        kind: 'sync',
        items: relatedSyncs.map(s => ({
          name: s.syncName as string,
          summary: `[${s.annotation}] ${((s.triggers as string[]) || []).join(', ')} → ${((s.effects as string[]) || []).join(', ')}`,
        })),
      });
    }

    // Find handler
    const allHandlers = await storage.find('handlers');
    const handler = allHandlers.find(h =>
      (h.handlerConcept as string)?.toLowerCase() === conceptName.toLowerCase(),
    );
    if (handler) {
      groups.push({
        relation: 'handler',
        kind: 'handler',
        items: [{
          name: `${handler.handlerConcept}:${handler.handlerLanguage}`,
          summary: `${handler.handlerFile} (${handler.handlerLineCount} lines, ${((handler.handlerActions as string[]) || []).length} actions)`,
        }],
      });
    }

    // Find suite membership
    const allSuites = await storage.find('suiteManifests');
    const memberSuites = allSuites.filter(s =>
      ((s.suiteConcepts as string[]) || []).some(c =>
        c.toLowerCase() === conceptName.toLowerCase(),
      ),
    );
    if (memberSuites.length > 0) {
      groups.push({
        relation: 'suites',
        kind: 'suite',
        items: memberSuites.map(s => ({
          name: s.suiteName as string,
          summary: `v${s.suiteVersion} (${((s.suiteConcepts as string[]) || []).length} concepts)`,
        })),
      });
    }
  }

  if (kind === 'sync') {
    const triggers = (item.triggers as string[]) || [];
    const effects = (item.effects as string[]) || [];

    // Extract concept names from trigger/effect strings
    const triggerConcepts = new Set(triggers.map(t => t.split('/')[0]).filter(Boolean));
    const effectConcepts = new Set(effects.map(e => e.split('/')[0]).filter(Boolean));

    if (triggerConcepts.size > 0) {
      groups.push({
        relation: 'triggers',
        kind: 'concept',
        items: Array.from(triggerConcepts).map(c => ({
          name: c,
          summary: triggers.filter(t => t.startsWith(c)).join(', '),
        })),
      });
    }

    if (effectConcepts.size > 0) {
      groups.push({
        relation: 'effects',
        kind: 'concept',
        items: Array.from(effectConcepts).map(c => ({
          name: c,
          summary: effects.filter(e => e.startsWith(c)).join(', '),
        })),
      });
    }
  }

  if (kind === 'suite') {
    const concepts = (item.suiteConcepts as string[]) || [];
    const syncs = (item.suiteSyncs as string[]) || [];

    if (concepts.length > 0) {
      groups.push({
        relation: 'concepts',
        kind: 'concept',
        items: concepts.map(c => ({ name: c, summary: c })),
      });
    }
    if (syncs.length > 0) {
      groups.push({
        relation: 'syncs',
        kind: 'sync',
        items: syncs.map(s => ({ name: s, summary: s })),
      });
    }
  }

  if (kind === 'handler') {
    const actions = (item.handlerActions as string[]) || [];
    if (actions.length > 0) {
      groups.push({
        relation: 'implementedActions',
        kind: 'action',
        items: actions.map(a => ({ name: a, summary: a })),
      });
    }
  }

  return groups;
}

// ─── Lookup helper ───────────────────────────────────────

async function lookupItem(
  kind: string,
  name: string,
  storage: ConceptStorage,
): Promise<Record<string, unknown> | null> {
  const collection = KIND_COLLECTION[kind];
  if (!collection) return null;

  // Try direct key lookup
  const key = `${kind}:${name}`;
  const direct = await storage.get(collection, key);
  if (direct) return direct;

  // Fuzzy search by name field
  const nameField = kind === 'concept' ? 'conceptName'
    : kind === 'sync' ? 'syncName'
    : kind === 'symbol' ? 'symbolName'
    : kind === 'file' ? 'filePath'
    : kind === 'handler' ? 'handlerConcept'
    : kind === 'suite' ? 'suiteName'
    : kind === 'deployment' ? 'deploymentName'
    : kind === 'interface' ? 'interfaceName'
    : null;

  if (!nameField) return null;

  const all = await storage.find(collection);
  return all.find(item =>
    String(item[nameField]).toLowerCase() === name.toLowerCase(),
  ) || null;
}

// ─── ScoreNavigator Handler ──────────────────────────────

export const scoreNavigatorHandler: ConceptHandler = {
  async show(input, storage) {
    const kind = input.kind as string;
    const name = input.name as string;

    if (!kind || !name) {
      return { variant: 'notfound', kind: kind || '', name: name || '' };
    }

    if (!KIND_COLLECTION[kind]) {
      return {
        variant: 'notfound',
        kind,
        name,
        message: `Unknown kind "${kind}". Valid kinds: ${VALID_KINDS.join(', ')}`,
      };
    }

    const item = await lookupItem(kind, name, storage);
    if (!item) {
      return { variant: 'notfound', kind, name };
    }

    const related = await findRelated(kind, item, storage);

    // Set cursor
    await storage.put('cursor', 'current', { kind, name });
    // Clear history on fresh show
    await storage.put('history', 'stack', { items: [] });

    return {
      variant: 'ok',
      item: JSON.stringify(item, null, 2),
      related: JSON.stringify(related, null, 2),
      cursor: `${kind}:${name}`,
    };
  },

  async traverse(input, storage) {
    const relation = input.relation as string;
    const target = input.target as string;

    if (!relation || !target) {
      return { variant: 'notfound', relation: relation || '', target: target || '' };
    }

    // Get current cursor
    const cursor = await storage.get('cursor', 'current');
    if (!cursor) {
      return {
        variant: 'notfound',
        relation,
        target,
        message: 'No cursor set. Call show() first.',
      };
    }

    const currentKind = cursor.kind as string;
    const currentName = cursor.name as string;

    // Look up current item to find the relation
    const currentItem = await lookupItem(currentKind, currentName, storage);
    if (!currentItem) {
      return { variant: 'notfound', relation, target };
    }

    const related = await findRelated(currentKind, currentItem, storage);
    const group = related.find(g => g.relation === relation);
    if (!group) {
      const available = related.map(g => g.relation).join(', ');
      return {
        variant: 'notfound',
        relation,
        target,
        message: `No relation "${relation}" on ${currentKind}:${currentName}. Available: ${available}`,
      };
    }

    // Find the target in the group
    const targetItem = group.items.find(i =>
      i.name.toLowerCase() === target.toLowerCase(),
    );
    if (!targetItem) {
      const available = group.items.map(i => i.name).join(', ');
      return {
        variant: 'notfound',
        relation,
        target,
        message: `"${target}" not found in ${relation}. Available: ${available}`,
      };
    }

    // Navigate to the target
    const targetKind = group.kind;
    const newItem = await lookupItem(targetKind, target, storage);

    // Push current to history
    const history = await storage.get('history', 'stack');
    const stack = ((history?.items as string[]) || []);
    stack.push(`${currentKind}:${currentName}`);
    await storage.put('history', 'stack', { items: stack });

    // Update cursor
    await storage.put('cursor', 'current', { kind: targetKind, name: target });

    if (!newItem) {
      // Target exists as a relation reference but not in the index
      return {
        variant: 'ok',
        item: JSON.stringify({ name: target, kind: targetKind, note: 'Not indexed — reference only' }, null, 2),
        related: '[]',
        cursor: `${targetKind}:${target}`,
      };
    }

    const newRelated = await findRelated(targetKind, newItem, storage);
    return {
      variant: 'ok',
      item: JSON.stringify(newItem, null, 2),
      related: JSON.stringify(newRelated, null, 2),
      cursor: `${targetKind}:${target}`,
    };
  },

  async back(_input, storage) {
    const history = await storage.get('history', 'stack');
    const stack = ((history?.items as string[]) || []);

    if (stack.length === 0) {
      return { variant: 'empty' };
    }

    const prev = stack.pop()!;
    await storage.put('history', 'stack', { items: stack });

    const [kind, ...nameParts] = prev.split(':');
    const name = nameParts.join(':');

    await storage.put('cursor', 'current', { kind, name });

    const item = await lookupItem(kind, name, storage);
    if (!item) {
      return {
        variant: 'ok',
        item: JSON.stringify({ kind, name, note: 'Not indexed' }, null, 2),
        related: '[]',
        cursor: prev,
      };
    }

    const related = await findRelated(kind, item, storage);
    return {
      variant: 'ok',
      item: JSON.stringify(item, null, 2),
      related: JSON.stringify(related, null, 2),
      cursor: prev,
    };
  },

  async list(input, storage) {
    const kind = input.kind as string;
    if (!kind) {
      return { variant: 'error', message: `kind is required. Valid kinds: ${VALID_KINDS.join(', ')}` };
    }

    const collection = KIND_COLLECTION[kind];
    if (!collection) {
      return { variant: 'error', message: `Unknown kind "${kind}". Valid kinds: ${VALID_KINDS.join(', ')}` };
    }

    const all = await storage.find(collection);
    const items = all.map(item => {
      // Extract a display name based on kind
      const nameField = kind === 'concept' ? 'conceptName'
        : kind === 'sync' ? 'syncName'
        : kind === 'symbol' ? 'symbolName'
        : kind === 'file' ? 'filePath'
        : kind === 'handler' ? 'handlerConcept'
        : kind === 'suite' ? 'suiteName'
        : kind === 'deployment' ? 'deploymentName'
        : kind === 'interface' ? 'interfaceName'
        : null;
      return {
        name: nameField ? item[nameField] : JSON.stringify(item).slice(0, 80),
        ...item,
      };
    });

    return {
      variant: 'ok',
      items: JSON.stringify(items, null, 2),
    };
  },
};
