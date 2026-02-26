// Renderer Concept Implementation
import type { ConceptHandler } from '@clef/kernel';

export const rendererHandler: ConceptHandler = {
  async render(input, storage) {
    const renderer = input.renderer as string;
    const tree = input.tree as string;

    if (!tree) {
      return { variant: 'error', message: 'Render tree is required' };
    }

    const existing = await storage.get('renderer', renderer);
    const placeholders = existing
      ? JSON.parse((existing.placeholders as string) || '{}')
      : {};

    let output = tree;
    for (const [name, value] of Object.entries(placeholders)) {
      output = output.replace(`{{${name}}}`, value as string);
    }

    await storage.put('renderer', renderer, {
      renderer,
      renderTree: tree,
      placeholders: JSON.stringify(placeholders),
      cacheability: existing?.cacheability ?? '{}',
    });

    return { variant: 'ok', output };
  },

  async autoPlaceholder(input, storage) {
    const renderer = input.renderer as string;
    const name = input.name as string;

    const existing = await storage.get('renderer', renderer);
    const placeholders = existing
      ? JSON.parse((existing.placeholders as string) || '{}')
      : {};

    const placeholder = `{{${name}}}`;
    placeholders[name] = '';

    await storage.put('renderer', renderer, {
      renderer,
      renderTree: existing?.renderTree ?? '',
      placeholders: JSON.stringify(placeholders),
      cacheability: existing?.cacheability ?? '{}',
    });

    return { variant: 'ok', placeholder };
  },

  async stream(input, storage) {
    const renderer = input.renderer as string;
    const tree = input.tree as string;

    if (!tree) {
      return { variant: 'error', message: 'Render tree is required for streaming' };
    }

    const streamId = `stream-${renderer}-${Date.now()}`;

    const existing = await storage.get('renderer', renderer);
    await storage.put('renderer', renderer, {
      renderer,
      renderTree: tree,
      placeholders: existing?.placeholders ?? '{}',
      cacheability: existing?.cacheability ?? '{}',
    });

    return { variant: 'ok', streamId };
  },

  async mergeCacheability(input, storage) {
    const renderer = input.renderer as string;
    const tags = input.tags as string;

    const existing = await storage.get('renderer', renderer);
    const currentCacheability = existing
      ? JSON.parse((existing.cacheability as string) || '{}')
      : {};

    const incomingTags = JSON.parse(tags || '{}');
    const merged = { ...currentCacheability, ...incomingTags };

    await storage.put('renderer', renderer, {
      renderer,
      renderTree: existing?.renderTree ?? '',
      placeholders: existing?.placeholders ?? '{}',
      cacheability: JSON.stringify(merged),
    });

    return { variant: 'ok', merged: JSON.stringify(merged) };
  },
};
