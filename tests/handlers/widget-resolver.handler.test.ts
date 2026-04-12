import { beforeEach, describe, expect, it } from 'vitest';
import { affordanceHandler } from '../../handlers/ts/app/affordance.handler.js';
import { widgetResolverHandler } from '../../handlers/ts/app/widget-resolver.handler.js';
import { buildDisplayWidgetContext } from '../../clef-base/lib/widget-selection.js';

interface TestStorage {
  get(relation: string, key: string): Promise<Record<string, unknown> | null>;
  put(relation: string, key: string, value: Record<string, unknown>): Promise<void>;
  find(relation: string, criteria?: unknown): Promise<Record<string, unknown>[]>;
}

function createTestStorage(): TestStorage {
  const data = new Map<string, Map<string, Record<string, unknown>>>();
  function getRelation(name: string) {
    let rel = data.get(name);
    if (!rel) {
      rel = new Map();
      data.set(name, rel);
    }
    return rel;
  }
  return {
    async get(relation, key) {
      const entry = getRelation(relation).get(key);
      return entry ? { ...entry } : null;
    },
    async put(relation, key, value) {
      getRelation(relation).set(key, { ...value });
    },
    async find(relation) {
      return Array.from(getRelation(relation).values()).map((entry) => ({ ...entry }));
    },
  };
}

describe('widgetResolverHandler', () => {
  let storage: TestStorage;

  beforeEach(async () => {
    storage = createTestStorage();
    await storage.put('widget', 'approval-detail', {
      widget: 'approval-detail',
      requires: JSON.stringify({
        version: 1,
        fields: [
          { name: 'status', type: 'String' },
          { name: 'actor', type: 'entity' },
          { name: 'body', type: 'String' },
        ],
        actions: [{ name: 'approve' }, { name: 'reject' }],
      }),
    });
    await affordanceHandler.declare!(
      {
        affordance: 'approval-aff',
        widget: 'approval-detail',
        interactor: 'entity-detail',
        specificity: 20,
        conditions: JSON.stringify({ concept: 'Approval', motif: 'stacked' }),
        bind: JSON.stringify({ actor: 'approver', body: 'reasoning' }),
        contractVersion: 1,
        densityExempt: true,
        motifOptimized: 'stacked',
      },
      storage as any,
    );
  });

  it('resolves entity widgets with theme-aware scoring', async () => {
    const result = await widgetResolverHandler.resolve!(
      {
        resolver: 'ent-1',
        element: 'entity-detail',
        context: JSON.stringify({
          concept: 'Approval',
          motif: 'stacked',
          fields: [
            { name: 'status', type: 'String' },
            { name: 'approver', type: 'String' },
            { name: 'reasoning', type: 'String' },
          ],
          actions: ['approve', 'reject'],
        }),
      },
      storage as any,
    );
    expect(result.variant).toBe('ok');
    expect(result.widget).toBe('approval-detail');
    expect(result.reason).toContain('Selected approval-detail');
    expect(result.reason).toContain('motifBonus=stacked');
  });

  it('falls back to a default widget when no affordance exists', async () => {
    const result = await widgetResolverHandler.resolve!(
      {
        resolver: 'ent-2',
        element: 'unmatched-element',
        context: '{}',
      },
      storage as any,
    );
    expect(result.variant).toBe('ok');
    expect(result.widget).toBe('unmatched-element-widget');
    expect(result.reason).toContain('Fallback widget selected');
  });

  it('adds density bonus for density-exempt affordances', async () => {
    await storage.put('widget', 'comfortable-dialog', { widget: 'comfortable-dialog' });
    await affordanceHandler.declare!(
      {
        affordance: 'dialog-aff',
        widget: 'comfortable-dialog',
        interactor: 'dialog',
        specificity: 10,
        conditions: '{}',
        densityExempt: true,
      },
      storage as any,
    );
    const result = await widgetResolverHandler.resolve!(
      { resolver: 'field-1', element: 'dialog', context: JSON.stringify({ density: 'compact' }) },
      storage as any,
    );
    expect(result.variant).toBe('ok');
    expect(result.reason).toContain('densityExempt=true');
  });

  it('prefers the motif-aligned affordance and falls back to density when motif ties', async () => {
    await storage.put('widget', 'admin-table-display', { widget: 'admin-table-display' });
    await storage.put('widget', 'admin-card-grid-display', { widget: 'admin-card-grid-display' });

    await affordanceHandler.declare!(
      {
        affordance: 'collection-topbar-display',
        widget: 'admin-table-display',
        interactor: 'records-collection',
        specificity: 72,
        conditions: '{}',
        densityExempt: true,
        motifOptimized: 'topbar',
      },
      storage as any,
    );
    await affordanceHandler.declare!(
      {
        affordance: 'collection-sidebar-display',
        widget: 'admin-card-grid-display',
        interactor: 'records-collection',
        specificity: 68,
        conditions: '{}',
        densityExempt: false,
        motifOptimized: 'sidebar',
      },
      storage as any,
    );

    const compactTopbar = buildDisplayWidgetContext({
      viewId: 'content-list',
      layout: 'table',
      rowCount: 4,
      fieldCount: 6,
      density: 'compact',
      motif: 'topbar',
      styleProfile: 'editorial',
      sourceType: 'expressive-theme',
    });
    const compactResult = await widgetResolverHandler.resolve!(
      {
        resolver: 'clef-base-view-resolver',
        element: 'records-collection',
        context: JSON.stringify(compactTopbar),
      },
      storage as any,
    );
    expect(compactResult.variant).toBe('ok');
    expect(compactResult.widget).toBe('admin-table-display');
    expect(compactResult.reason).toContain('motifBonus=topbar');
    expect(compactResult.reason).toContain('densityExempt=true');

    const comfortableSidebar = buildDisplayWidgetContext({
      viewId: 'content-grid',
      layout: 'card-grid',
      rowCount: 12,
      fieldCount: 6,
      density: 'comfortable',
      motif: 'sidebar',
      styleProfile: 'editorial',
      sourceType: 'expressive-theme',
    });
    const comfortableResult = await widgetResolverHandler.resolve!(
      {
        resolver: 'clef-base-view-resolver',
        element: 'records-collection',
        context: JSON.stringify(comfortableSidebar),
      },
      storage as any,
    );
    expect(comfortableResult.variant).toBe('ok');
    expect(comfortableResult.widget).toBe('admin-card-grid-display');
    expect(comfortableResult.reason).toContain('motifBonus=sidebar');
  });
});
