import { describe, expect, it } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { viewHandler } from '../handlers/ts/app/view.handler.js';

describe('View — Contextual Filters', () => {
  it('adds a contextual filter to a view', async () => {
    const storage = createInMemoryStorage();

    await viewHandler.create({
      view: 'backlinks',
      dataSource: '{"concept":"ContentNode","action":"list"}',
      layout: 'table',
    }, storage);

    const result = await viewHandler.addContextualFilter({
      view: 'backlinks',
      field: 'Backlink.target',
      operator: 'equals',
      context_binding: 'context.entity',
      fallback_behavior: 'hide',
    }, storage);

    expect(result.variant).toBe('ok');
    const filter = JSON.parse(result.filter as string);
    expect(filter.source_type).toBe('contextual');
    expect(filter.context_binding).toBe('context.entity');
    expect(filter.fallback_behavior).toBe('hide');
  });

  it('rejects invalid context binding', async () => {
    const storage = createInMemoryStorage();

    await viewHandler.create({
      view: 'test-view',
      dataSource: '{"concept":"ContentNode","action":"list"}',
      layout: 'table',
    }, storage);

    const result = await viewHandler.addContextualFilter({
      view: 'test-view',
      field: 'target',
      operator: 'equals',
      context_binding: 'invalid.path',
      fallback_behavior: 'hide',
    }, storage);

    expect(result.variant).toBe('invalid_binding');
  });

  it('supports hide fallback behavior', async () => {
    const storage = createInMemoryStorage();

    await viewHandler.create({
      view: 'v1',
      dataSource: '{"concept":"X","action":"list"}',
      layout: 'table',
    }, storage);

    await viewHandler.addContextualFilter({
      view: 'v1',
      field: 'target',
      operator: 'equals',
      context_binding: 'context.entity',
      fallback_behavior: 'hide',
    }, storage);

    const get = await viewHandler.get({ view: 'v1' }, storage);
    const filters = JSON.parse(get.filters as string);
    expect(filters).toHaveLength(1);
    expect(filters[0].fallback_behavior).toBe('hide');
  });

  it('supports show_empty fallback behavior', async () => {
    const storage = createInMemoryStorage();

    await viewHandler.create({
      view: 'v2',
      dataSource: '{"concept":"X","action":"list"}',
      layout: 'table',
    }, storage);

    await viewHandler.addContextualFilter({
      view: 'v2',
      field: 'target',
      operator: 'equals',
      context_binding: 'context.entity',
      fallback_behavior: 'show_empty',
    }, storage);

    const get = await viewHandler.get({ view: 'v2' }, storage);
    const filters = JSON.parse(get.filters as string);
    expect(filters[0].fallback_behavior).toBe('show_empty');
  });

  it('supports ignore_filter fallback behavior', async () => {
    const storage = createInMemoryStorage();

    await viewHandler.create({
      view: 'v3',
      dataSource: '{"concept":"X","action":"list"}',
      layout: 'table',
    }, storage);

    await viewHandler.addContextualFilter({
      view: 'v3',
      field: 'target',
      operator: 'equals',
      context_binding: 'context.entity',
      fallback_behavior: 'ignore_filter',
    }, storage);

    const get = await viewHandler.get({ view: 'v3' }, storage);
    const filters = JSON.parse(get.filters as string);
    expect(filters[0].fallback_behavior).toBe('ignore_filter');
  });

  it('returns notfound for missing view', async () => {
    const storage = createInMemoryStorage();

    const result = await viewHandler.addContextualFilter({
      view: 'nonexistent',
      field: 'target',
      operator: 'equals',
      context_binding: 'context.entity',
      fallback_behavior: 'hide',
    }, storage);

    expect(result.variant).toBe('notfound');
  });

  it('appends contextual filters to existing static filters', async () => {
    const storage = createInMemoryStorage();

    await viewHandler.create({
      view: 'combined',
      dataSource: '{"concept":"X","action":"list"}',
      layout: 'table',
      filters: '[{"field":"status","value":"active","source_type":"static"}]',
    }, storage);

    await viewHandler.addContextualFilter({
      view: 'combined',
      field: 'target',
      operator: 'equals',
      context_binding: 'context.entity',
      fallback_behavior: 'hide',
    }, storage);

    const get = await viewHandler.get({ view: 'combined' }, storage);
    const filters = JSON.parse(get.filters as string);
    expect(filters).toHaveLength(2);
    expect(filters[0].source_type).toBe('static');
    expect(filters[1].source_type).toBe('contextual');
  });
});
