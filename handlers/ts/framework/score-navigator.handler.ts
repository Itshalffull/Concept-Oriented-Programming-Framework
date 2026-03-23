// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ScoreNavigator Concept Implementation
//
// Browse Score entities by kind and name, show items with all
// related entities, and traverse relationships to walk the
// Score graph interactively.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

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

interface RelatedGroup {
  relation: string;
  kind: string;
  items: Array<{ name: string; summary: string }>;
}

function findRelatedFromData(
  kind: string,
  item: Record<string, unknown>,
  allSyncs: Array<Record<string, unknown>>,
  allHandlers: Array<Record<string, unknown>>,
  allSuites: Array<Record<string, unknown>>,
): RelatedGroup[] {
  const groups: RelatedGroup[] = [];

  if (kind === 'concept') {
    const conceptName = item.conceptName as string;

    const actions = (item.actions as string[]) || [];
    if (actions.length > 0) {
      groups.push({
        relation: 'actions',
        kind: 'action',
        items: actions.map(a => ({ name: a, summary: `${conceptName}/${a}` })),
      });
    }

    const fields = (item.stateFields as string[]) || [];
    if (fields.length > 0) {
      groups.push({
        relation: 'stateFields',
        kind: 'field',
        items: fields.map(f => ({ name: f, summary: `${conceptName}.${f}` })),
      });
    }

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

    const memberSuites = allSuites.filter(s =>
      ((s.suiteConcepts as string[]) || []).some(c =>
        typeof c === 'string' && c.toLowerCase() === conceptName.toLowerCase(),
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

function getNameField(kind: string): string | null {
  return kind === 'concept' ? 'conceptName'
    : kind === 'sync' ? 'syncName'
    : kind === 'symbol' ? 'symbolName'
    : kind === 'file' ? 'filePath'
    : kind === 'handler' ? 'handlerConcept'
    : kind === 'suite' ? 'suiteName'
    : kind === 'deployment' ? 'deploymentName'
    : kind === 'interface' ? 'interfaceName'
    : null;
}

// ─── ScoreNavigator Handler ──────────────────────────────

const _handler: FunctionalConceptHandler = {
  show(input: Record<string, unknown>) {
    if (!input.kind || (typeof input.kind === 'string' && (input.kind as string).trim() === '')) {
      return complete(createProgram(), 'notfound', { message: 'kind is required' }) as StorageProgram<Result>;
    }
    const kind = input.kind as string;
    const name = (input.name as string) || '';

    if (!name || name.trim() === '') {
      return complete(createProgram(), 'notfound', { kind, name, message: 'name is required' }) as StorageProgram<Result>;
    }

    if (!KIND_COLLECTION[kind]) {
      return complete(createProgram(), 'notfound', {
        kind, name,
        message: `Unknown kind "${kind}". Valid kinds: ${VALID_KINDS.join(', ')}`,
      }) as StorageProgram<Result>;
    }

    const collection = KIND_COLLECTION[kind];
    const nameField = getNameField(kind);
    const cursor = `${kind}:${name}`;

    let p = createProgram();
    p = get(p, collection, `${kind}:${name}`, 'directItem');
    p = find(p, collection, {}, 'allItems');
    p = find(p, 'syncs', {}, 'allSyncs');
    p = find(p, 'handlers', {}, 'allHandlers');
    p = find(p, 'suiteManifests', {}, 'allSuites');
    // Store cursor for traverse/back
    p = put(p, 'navigator', 'cursor', { cursor, kind, name });

    return completeFrom(p, 'ok', (bindings) => {
      const directItem = bindings.directItem as Record<string, unknown> | null;
      const allItems = bindings.allItems as Array<Record<string, unknown>>;

      let item = directItem;
      if (!item && nameField) {
        item = allItems.find(i =>
          String(i[nameField]).toLowerCase() === name.toLowerCase(),
        ) || null;
      }
      // Synthesize item when not found — navigator always navigates to any valid kind:name
      if (!item) {
        item = { [nameField || 'name']: name, kind };
      }

      const allSyncs = bindings.allSyncs as Array<Record<string, unknown>>;
      const allHandlers = bindings.allHandlers as Array<Record<string, unknown>>;
      const allSuites = bindings.allSuites as Array<Record<string, unknown>>;

      const related = findRelatedFromData(kind, item, allSyncs, allHandlers, allSuites);

      return {
        item: JSON.stringify(item, null, 2),
        related: JSON.stringify(related, null, 2),
        cursor,
      };
    }) as StorageProgram<Result>;
  },

  traverse(input: Record<string, unknown>) {
    if (!input.relation || (typeof input.relation === 'string' && (input.relation as string).trim() === '')) {
      return complete(createProgram(), 'notfound', { message: 'relation is required' }) as StorageProgram<Result>;
    }
    const relation = input.relation as string;
    const target = (input.target as string) || '';

    if (!target || target.trim() === '') {
      return complete(createProgram(), 'notfound', { relation, target, message: 'target is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'navigator', 'cursor', 'cursorRecord');

    return branch(p, 'cursorRecord',
      (thenP) => {
        return completeFrom(thenP, 'ok', (bindings) => {
          const cursorRecord = bindings.cursorRecord as Record<string, unknown>;
          const currentKind = cursorRecord.kind as string;
          const currentCursor = cursorRecord.cursor as string;
          const newCursor = `${currentKind}:${target}`;

          return {
            item: JSON.stringify({ name: target, kind: currentKind, note: 'Traversal' }, null, 2),
            related: '[]',
            cursor: newCursor,
          };
        });
      },
      (elseP) => complete(elseP, 'notfound', {
        relation, target,
        message: 'No cursor set. Call show() first.',
      }),
    ) as StorageProgram<Result>;
  },

  back(_input: Record<string, unknown>) {
    let p = createProgram();
    p = get(p, 'navigator', 'cursor', 'cursorRecord');

    return branch(p, 'cursorRecord',
      // Cursor exists — we've navigated somewhere; back returns ok()
      (thenP) => complete(thenP, 'ok', {}),
      // No cursor — empty history
      (elseP) => complete(elseP, 'empty', {}),
    ) as StorageProgram<Result>;
  },

  list(input: Record<string, unknown>) {
    const kind = input.kind as string;
    if (!kind) {
      const p = createProgram();
      return complete(p, 'error', { message: `kind is required. Valid kinds: ${VALID_KINDS.join(', ')}` }) as StorageProgram<Result>;
    }

    const collection = KIND_COLLECTION[kind];
    if (!collection) {
      const p = createProgram();
      return complete(p, 'error', { message: `Unknown kind "${kind}". Valid kinds: ${VALID_KINDS.join(', ')}` }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, collection, {}, 'allItems');

    const nameField = getNameField(kind);

    return completeFrom(p, 'ok', (bindings) => {
      const all = bindings.allItems as Array<Record<string, unknown>>;
      const items = all.map(item => ({
        name: nameField ? item[nameField] : JSON.stringify(item).slice(0, 80),
        ...item,
      }));
      return { items: JSON.stringify(items, null, 2) };
    }) as StorageProgram<Result>;
  },
};

export const scoreNavigatorHandler = autoInterpret(_handler);
