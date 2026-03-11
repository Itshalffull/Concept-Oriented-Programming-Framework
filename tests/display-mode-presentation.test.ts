import { describe, expect, it } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { displayModeHandler } from '../handlers/ts/app/display-mode.handler.js';

describe('DisplayMode v2 — Presentation Layer', () => {
  it('creates a display mode with (schema, mode_id) composite key', async () => {
    const storage = createInMemoryStorage();

    const result = await displayModeHandler.create({
      schema: 'Article',
      mode_id: 'full',
      name: 'Full Page',
    }, storage);

    expect(result.variant).toBe('ok');
    expect(result.mode).toBe('Article:full');
  });

  it('rejects duplicate (schema, mode_id) pairs', async () => {
    const storage = createInMemoryStorage();

    await displayModeHandler.create({
      schema: 'Article',
      mode_id: 'full',
      name: 'Full Page',
    }, storage);

    const dup = await displayModeHandler.create({
      schema: 'Article',
      mode_id: 'full',
      name: 'Full Page Again',
    }, storage);

    expect(dup.variant).toBe('already_exists');
  });

  it('resolves by (schema, mode_id)', async () => {
    const storage = createInMemoryStorage();

    await displayModeHandler.create({
      schema: 'Article',
      mode_id: 'teaser',
      name: 'Teaser Card',
    }, storage);

    const found = await displayModeHandler.resolve({
      schema: 'Article',
      mode_id: 'teaser',
    }, storage);

    expect(found.variant).toBe('ok');
    expect(found.mode).toBe('Article:teaser');
  });

  it('returns not_found for missing modes', async () => {
    const storage = createInMemoryStorage();

    const result = await displayModeHandler.resolve({
      schema: 'Article',
      mode_id: 'nonexistent',
    }, storage);

    expect(result.variant).toBe('not_found');
  });

  it('set_layout clears component_mapping (mutual exclusion)', async () => {
    const storage = createInMemoryStorage();

    await displayModeHandler.create({
      schema: 'Article',
      mode_id: 'full',
      name: 'Full Page',
    }, storage);

    // Set component mapping first
    await displayModeHandler.set_component_mapping({
      mode: 'Article:full',
      mapping: 'hero-card',
    }, storage);

    // Set layout — should clear component_mapping
    await displayModeHandler.set_layout({
      mode: 'Article:full',
      layout: 'triple-zone-default',
    }, storage);

    const result = await displayModeHandler.get({ mode: 'Article:full' }, storage);
    expect(result.variant).toBe('ok');
    expect(result.layout).toBe('triple-zone-default');
    expect(result.component_mapping).toBeNull();
  });

  it('set_component_mapping clears layout (mutual exclusion)', async () => {
    const storage = createInMemoryStorage();

    await displayModeHandler.create({
      schema: 'Article',
      mode_id: 'full',
      name: 'Full Page',
    }, storage);

    // Set layout first
    await displayModeHandler.set_layout({
      mode: 'Article:full',
      layout: 'triple-zone-default',
    }, storage);

    // Set component_mapping — should clear layout
    await displayModeHandler.set_component_mapping({
      mode: 'Article:full',
      mapping: 'article-hero-card',
    }, storage);

    const result = await displayModeHandler.get({ mode: 'Article:full' }, storage);
    expect(result.variant).toBe('ok');
    expect(result.component_mapping).toBe('article-hero-card');
    expect(result.layout).toBeNull();
  });

  it('list_for_schema returns modes for that schema only', async () => {
    const storage = createInMemoryStorage();

    await displayModeHandler.create({ schema: 'Article', mode_id: 'full', name: 'Full' }, storage);
    await displayModeHandler.create({ schema: 'Article', mode_id: 'teaser', name: 'Teaser' }, storage);
    await displayModeHandler.create({ schema: 'Page', mode_id: 'full', name: 'Page Full' }, storage);

    const result = await displayModeHandler.list_for_schema({ schema: 'Article' }, storage);
    expect(result.variant).toBe('ok');
    const modes = JSON.parse(result.modes as string);
    expect(modes).toHaveLength(2);
    expect(modes.every((m: Record<string, unknown>) => m.schema === 'Article')).toBe(true);
  });

  it('get returns full configuration', async () => {
    const storage = createInMemoryStorage();

    await displayModeHandler.create({ schema: 'Article', mode_id: 'full', name: 'Full Page' }, storage);
    await displayModeHandler.set_flat_fields({
      mode: 'Article:full',
      placements: JSON.stringify(['fp-1', 'fp-2']),
    }, storage);

    const result = await displayModeHandler.get({ mode: 'Article:full' }, storage);
    expect(result.variant).toBe('ok');
    expect(result.name).toBe('Full Page');
    expect(result.mode_id).toBe('full');
    expect(result.schema).toBe('Article');
    expect(result.layout).toBeNull();
    expect(result.component_mapping).toBeNull();
  });

  it('delete removes a mode', async () => {
    const storage = createInMemoryStorage();

    await displayModeHandler.create({ schema: 'Article', mode_id: 'full', name: 'Full' }, storage);
    const delResult = await displayModeHandler.delete({ mode: 'Article:full' }, storage);
    expect(delResult.variant).toBe('ok');

    const getResult = await displayModeHandler.get({ mode: 'Article:full' }, storage);
    expect(getResult.variant).toBe('not_found');
  });

  it('list returns all modes', async () => {
    const storage = createInMemoryStorage();

    await displayModeHandler.create({ schema: 'A', mode_id: 'x', name: 'X' }, storage);
    await displayModeHandler.create({ schema: 'B', mode_id: 'y', name: 'Y' }, storage);

    const result = await displayModeHandler.list({}, storage);
    expect(result.variant).toBe('ok');
    const items = JSON.parse(result.items as string);
    expect(items.length).toBeGreaterThanOrEqual(2);
  });
});
