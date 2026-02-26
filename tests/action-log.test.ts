// ============================================================
// ActionLog Tests
//
// Validates the ActionLog concept handler — record appending,
// flow-based querying, and provenance edge tracking.
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  createInMemoryStorage,
} from '../kernel/src/index.js';
import { actionLogHandler } from '../handlers/ts/framework/action-log.handler.js';

// ============================================================
// ActionLog Concept
// ============================================================

describe('ActionLog Concept', () => {
  it('appends records and queries by flow', async () => {
    const storage = createInMemoryStorage();

    // Append two records in the same flow
    const r1 = await actionLogHandler.append({
      record: { type: 'completion', concept: 'A', action: 'foo', flow: 'flow-1' },
    }, storage);
    expect(r1.variant).toBe('ok');
    expect(r1.id).toBeTruthy();

    const r2 = await actionLogHandler.append({
      record: { type: 'invocation', concept: 'B', action: 'bar', flow: 'flow-1' },
    }, storage);
    expect(r2.variant).toBe('ok');

    // Append a record in a different flow
    await actionLogHandler.append({
      record: { type: 'completion', concept: 'C', action: 'baz', flow: 'flow-2' },
    }, storage);

    // Query by flow
    const query = await actionLogHandler.query({ flow: 'flow-1' }, storage);
    expect(query.variant).toBe('ok');
    expect((query.records as unknown[]).length).toBe(2);
  });

  it('adds provenance edges', async () => {
    const storage = createInMemoryStorage();

    const r1 = await actionLogHandler.append({
      record: { type: 'completion', concept: 'A', action: 'x', flow: 'f' },
    }, storage);
    const r2 = await actionLogHandler.append({
      record: { type: 'invocation', concept: 'B', action: 'y', flow: 'f' },
    }, storage);

    const edge = await actionLogHandler.addEdge({
      from: r1.id as string,
      to: r2.id as string,
      sync: 'MySync',
    }, storage);
    expect(edge.variant).toBe('ok');

    // Verify edge is stored
    const edges = await storage.find('edges');
    expect(edges).toHaveLength(1);
    expect(edges[0].sync).toBe('MySync');
  });
});
