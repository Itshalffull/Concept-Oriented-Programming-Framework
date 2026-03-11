import { describe, expect, it } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { fieldPlacementHandler } from '../handlers/ts/app/field-placement.handler.js';

describe('FieldPlacement — Display Configuration', () => {
  it('creates a placement with defaults', async () => {
    const storage = createInMemoryStorage();

    const result = await fieldPlacementHandler.create({
      source_field: 'Article.title',
      formatter: 'heading',
    }, storage);

    expect(result.variant).toBe('ok');
    expect(result.placement).toBeTruthy();

    const get = await fieldPlacementHandler.get({ placement: result.placement }, storage);
    expect(get.variant).toBe('ok');
    expect(get.source_field).toBe('Article.title');
    expect(get.formatter).toBe('heading');
    expect(get.label_display).toBe('above');
    expect(get.visible).toBe(true);
    expect(get.field_mapping).toBeNull();
  });

  it('configure applies partial updates', async () => {
    const storage = createInMemoryStorage();

    const { placement } = await fieldPlacementHandler.create({
      source_field: 'Article.title',
      formatter: 'heading',
    }, storage) as { placement: string };

    await fieldPlacementHandler.configure({
      placement,
      formatter_options: '{"level": 1}',
      label_display: 'inline',
    }, storage);

    const get = await fieldPlacementHandler.get({ placement }, storage);
    expect(get.formatter).toBe('heading'); // unchanged
    expect(get.formatter_options).toBe('{"level": 1}');
    expect(get.label_display).toBe('inline');
  });

  it('configure returns not_found for missing placement', async () => {
    const storage = createInMemoryStorage();

    const result = await fieldPlacementHandler.configure({
      placement: 'nonexistent',
      formatter: 'plain_text',
    }, storage);

    expect(result.variant).toBe('not_found');
  });

  it('set_visibility updates visible and role_visibility', async () => {
    const storage = createInMemoryStorage();

    const { placement } = await fieldPlacementHandler.create({
      source_field: 'Article.body',
      formatter: 'rich_text',
    }, storage) as { placement: string };

    await fieldPlacementHandler.set_visibility({
      placement,
      visible: false,
      role_visibility: '{"admin": true}',
    }, storage);

    const get = await fieldPlacementHandler.get({ placement }, storage);
    expect(get.visible).toBe(false);
    expect(get.role_visibility).toBe('{"admin": true}');
  });

  it('set_field_mapping and clear_field_mapping', async () => {
    const storage = createInMemoryStorage();

    const { placement } = await fieldPlacementHandler.create({
      source_field: 'Article.author',
      formatter: 'entity_reference',
    }, storage) as { placement: string };

    await fieldPlacementHandler.set_field_mapping({
      placement,
      mapping: 'author-avatar-card',
    }, storage);

    let get = await fieldPlacementHandler.get({ placement }, storage);
    expect(get.field_mapping).toBe('author-avatar-card');

    await fieldPlacementHandler.clear_field_mapping({ placement }, storage);

    get = await fieldPlacementHandler.get({ placement }, storage);
    expect(get.field_mapping).toBeNull();
  });

  it('duplicate creates a copy with same config', async () => {
    const storage = createInMemoryStorage();

    const { placement } = await fieldPlacementHandler.create({
      source_field: 'Article.title',
      formatter: 'heading',
    }, storage) as { placement: string };

    await fieldPlacementHandler.configure({
      placement,
      formatter_options: '{"level": 2}',
      label_display: 'hidden',
    }, storage);

    const dupResult = await fieldPlacementHandler.duplicate({ placement }, storage);
    expect(dupResult.variant).toBe('ok');
    expect(dupResult.new_placement).not.toBe(placement);

    const get = await fieldPlacementHandler.get({ placement: dupResult.new_placement }, storage);
    expect(get.variant).toBe('ok');
    expect(get.source_field).toBe('Article.title');
    expect(get.formatter).toBe('heading');
  });

  it('delete removes a placement', async () => {
    const storage = createInMemoryStorage();

    const { placement } = await fieldPlacementHandler.create({
      source_field: 'Article.title',
      formatter: 'heading',
    }, storage) as { placement: string };

    await fieldPlacementHandler.delete({ placement }, storage);

    const get = await fieldPlacementHandler.get({ placement }, storage);
    expect(get.variant).toBe('not_found');
  });

  it('list returns all placements', async () => {
    const storage = createInMemoryStorage();

    await fieldPlacementHandler.create({ source_field: 'a', formatter: 'x' }, storage);
    await fieldPlacementHandler.create({ source_field: 'b', formatter: 'y' }, storage);

    const result = await fieldPlacementHandler.list({}, storage);
    expect(result.variant).toBe('ok');
    const items = JSON.parse(result.items as string);
    expect(items.length).toBeGreaterThanOrEqual(2);
  });
});
