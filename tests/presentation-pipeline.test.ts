import { describe, expect, it } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { displayModeHandler } from '../handlers/ts/app/display-mode.handler.js';
import { fieldPlacementHandler } from '../handlers/ts/app/field-placement.handler.js';

describe('Presentation Pipeline — Rendering Path Integration', () => {
  it('Path 1: flat field list rendering (no layout, no mapping)', async () => {
    const dmStorage = createInMemoryStorage();
    const fpStorage = createInMemoryStorage();

    // Create placements
    const p1 = await fieldPlacementHandler.create({
      placement: 'fp-title',
      source_field: 'Article.title',
      formatter: 'heading',
    }, fpStorage);
    const p2 = await fieldPlacementHandler.create({
      placement: 'fp-date',
      source_field: 'Article.date',
      formatter: 'date_relative',
    }, fpStorage);

    // Create display mode with flat fields
    await displayModeHandler.create({
      schema: 'Article',
      mode_id: 'teaser',
      name: 'Teaser',
    }, dmStorage);

    await displayModeHandler.set_flat_fields({
      mode: 'Article:teaser',
      placements: JSON.stringify([p1.placement, p2.placement]),
    }, dmStorage);

    // Resolve mode
    const resolved = await displayModeHandler.resolve({
      schema: 'Article',
      mode_id: 'teaser',
    }, dmStorage);
    expect(resolved.variant).toBe('ok');

    // Get full config
    const config = await displayModeHandler.get({ mode: resolved.mode }, dmStorage);
    expect(config.variant).toBe('ok');
    expect(config.layout).toBeNull();
    expect(config.component_mapping).toBeNull();

    // Verify placements are retrievable
    const fp1 = await fieldPlacementHandler.get({ placement: p1.placement }, fpStorage);
    expect(fp1.variant).toBe('ok');
    expect(fp1.formatter).toBe('heading');
  });

  it('Path 2: Layout-based rendering (spatial areas)', async () => {
    const dmStorage = createInMemoryStorage();

    await displayModeHandler.create({
      schema: 'Article',
      mode_id: 'full',
      name: 'Full Page',
    }, dmStorage);

    await displayModeHandler.set_layout({
      mode: 'Article:full',
      layout: 'triple-zone-default',
    }, dmStorage);

    const config = await displayModeHandler.get({ mode: 'Article:full' }, dmStorage);
    expect(config.variant).toBe('ok');
    expect(config.layout).toBe('triple-zone-default');
    expect(config.component_mapping).toBeNull();
  });

  it('Path 3: ComponentMapping takeover rendering', async () => {
    const dmStorage = createInMemoryStorage();

    await displayModeHandler.create({
      schema: 'Article',
      mode_id: 'hero',
      name: 'Hero Card',
    }, dmStorage);

    await displayModeHandler.set_component_mapping({
      mode: 'Article:hero',
      mapping: 'article-hero-widget',
    }, dmStorage);

    const config = await displayModeHandler.get({ mode: 'Article:hero' }, dmStorage);
    expect(config.variant).toBe('ok');
    expect(config.component_mapping).toBe('article-hero-widget');
    expect(config.layout).toBeNull();
  });

  it('switching between strategies clears the other', async () => {
    const dmStorage = createInMemoryStorage();

    await displayModeHandler.create({
      schema: 'Article',
      mode_id: 'switchable',
      name: 'Switchable',
    }, dmStorage);

    // Start with layout
    await displayModeHandler.set_layout({ mode: 'Article:switchable', layout: 'triple-zone' }, dmStorage);
    let config = await displayModeHandler.get({ mode: 'Article:switchable' }, dmStorage);
    expect(config.layout).toBe('triple-zone');
    expect(config.component_mapping).toBeNull();

    // Switch to mapping
    await displayModeHandler.set_component_mapping({ mode: 'Article:switchable', mapping: 'hero' }, dmStorage);
    config = await displayModeHandler.get({ mode: 'Article:switchable' }, dmStorage);
    expect(config.component_mapping).toBe('hero');
    expect(config.layout).toBeNull();

    // Switch back to layout
    await displayModeHandler.set_layout({ mode: 'Article:switchable', layout: 'flat' }, dmStorage);
    config = await displayModeHandler.get({ mode: 'Article:switchable' }, dmStorage);
    expect(config.layout).toBe('flat');
    expect(config.component_mapping).toBeNull();
  });

  it('clear_layout falls back to flat fields', async () => {
    const dmStorage = createInMemoryStorage();

    await displayModeHandler.create({
      schema: 'Article',
      mode_id: 'clearable',
      name: 'Clearable',
    }, dmStorage);

    await displayModeHandler.set_layout({ mode: 'Article:clearable', layout: 'triple-zone' }, dmStorage);
    await displayModeHandler.clear_layout({ mode: 'Article:clearable' }, dmStorage);

    const config = await displayModeHandler.get({ mode: 'Article:clearable' }, dmStorage);
    expect(config.layout).toBeNull();
    expect(config.component_mapping).toBeNull();
  });

  it('FieldPlacement with ComponentMapping delegation', async () => {
    const fpStorage = createInMemoryStorage();

    const { placement } = await fieldPlacementHandler.create({
      source_field: 'Article.author',
      formatter: 'entity_reference',
    }, fpStorage) as { placement: string };

    await fieldPlacementHandler.set_field_mapping({
      placement,
      mapping: 'author-avatar-card',
    }, fpStorage);

    const config = await fieldPlacementHandler.get({ placement }, fpStorage);
    expect(config.variant).toBe('ok');
    expect(config.field_mapping).toBe('author-avatar-card');
    expect(config.formatter).toBe('entity_reference');
  });
});
