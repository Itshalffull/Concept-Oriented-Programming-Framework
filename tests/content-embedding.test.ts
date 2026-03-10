import { beforeEach, describe, expect, it } from 'vitest';

import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  contentEmbeddingHandler,
  resetContentEmbeddingCounter,
} from '../handlers/ts/app/content-embedding.handler.js';

describe('ContentEmbedding', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetContentEmbeddingCounter();
  });

  it('indexes and returns projection metadata for a content entity', async () => {
    const indexed = await contentEmbeddingHandler.index!(
      {
        entity_id: 'node-1',
        source_type: 'page',
        text: 'A note about graph thinking and embedded views.',
        model: 'text-embedding-3-small',
      },
      storage,
    );

    expect(indexed.variant).toBe('ok');

    const fetched = await contentEmbeddingHandler.get!(
      { entity_id: 'node-1' },
      storage,
    );

    expect(fetched).toMatchObject({
      variant: 'ok',
      entity_id: 'node-1',
      source_type: 'page',
      model: 'text-embedding-3-small',
    });
    expect((fetched.excerpt as string).length).toBeGreaterThan(0);
  });

  it('reuses the same embedding record when an entity is reindexed', async () => {
    const first = await contentEmbeddingHandler.index!(
      {
        entity_id: 'node-1',
        source_type: 'page',
        text: 'Original text',
        model: 'text-embedding-3-small',
      },
      storage,
    );
    const second = await contentEmbeddingHandler.index!(
      {
        entity_id: 'node-1',
        source_type: 'page',
        text: 'Updated text for the same entity',
        model: 'text-embedding-3-small',
      },
      storage,
    );

    expect(first.variant).toBe('ok');
    expect(second.variant).toBe('ok');
    expect(second.embedding).toBe(first.embedding);
  });

  it('finds similar entities within the requested scope', async () => {
    await contentEmbeddingHandler.index!(
      {
        entity_id: 'node-1',
        source_type: 'page',
        text: 'Knowledge graph pages and backlinks for research notes.',
        model: 'text-embedding-3-small',
      },
      storage,
    );
    await contentEmbeddingHandler.index!(
      {
        entity_id: 'node-2',
        source_type: 'page',
        text: 'Research notes with backlinks and graph-like navigation.',
        model: 'text-embedding-3-small',
      },
      storage,
    );
    await contentEmbeddingHandler.index!(
      {
        entity_id: 'node-3',
        source_type: 'task',
        text: 'Prepare invoices and close out the weekly operations checklist.',
        model: 'text-embedding-3-small',
      },
      storage,
    );

    const result = await contentEmbeddingHandler.searchSimilar!(
      { entity_id: 'node-1', topK: 5, source_type: 'page' },
      storage,
    );

    expect(result.variant).toBe('ok');
    const parsed = JSON.parse(result.results as string) as Array<Record<string, unknown>>;
    expect(parsed.length).toBe(1);
    expect(parsed[0].entity_id).toBe('node-2');
  });

  it('removes embeddings when the entity projection is deleted', async () => {
    await contentEmbeddingHandler.index!(
      {
        entity_id: 'node-9',
        source_type: 'page',
        text: 'Disposable content',
        model: 'text-embedding-3-small',
      },
      storage,
    );

    const removed = await contentEmbeddingHandler.remove!(
      { entity_id: 'node-9' },
      storage,
    );
    const fetched = await contentEmbeddingHandler.get!(
      { entity_id: 'node-9' },
      storage,
    );

    expect(removed).toEqual({ variant: 'ok', entity_id: 'node-9' });
    expect(fetched).toEqual({ variant: 'notfound', entity_id: 'node-9' });
  });

  it('rejects unsupported embedding models', async () => {
    const result = await contentEmbeddingHandler.index!(
      {
        entity_id: 'node-1',
        source_type: 'page',
        text: 'Hello',
        model: 'mystery-model',
      },
      storage,
    );

    expect(result).toEqual({ variant: 'modelUnavailable', model: 'mystery-model' });
  });
});
