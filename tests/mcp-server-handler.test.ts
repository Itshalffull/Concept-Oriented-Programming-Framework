import { describe, it, expect } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { inferActionFromToolName, inferConceptFromToolFile, seedScoreIndex } from '../handlers/ts/framework/mcp-server.handler.js';

describe('MCP server handler helpers', () => {
  it('infers concept names from generated tool file paths', () => {
    expect(inferConceptFromToolFile('.claude/mcp/score-api/score-api.tools.ts')).toBe('ScoreApi');
    expect(inferConceptFromToolFile('.claude/mcp/widget-implementation-entity/widget-implementation-entity.tools.ts')).toBe('WidgetImplementationEntity');
  });

  it('infers action names from tool names using the concept prefix', () => {
    expect(inferActionFromToolName('score_api_status', 'ScoreApi')).toBe('status');
    expect(inferActionFromToolName('score_index_upsert_file', 'ScoreIndex')).toBe('upsertFile');
    expect(inferActionFromToolName('widget_implementation_entity_resolve_render_frame', 'WidgetImplementationEntity')).toBe('resolveRenderFrame');
  });
});

describe('Score seeding', () => {
  it('seeds score collections with project data', async () => {
    const storage = createInMemoryStorage();
    await seedScoreIndex(storage);

    const concepts = await storage.find('concepts');
    const files = await storage.find('files');
    const symbols = await storage.find('symbols');
    const handlers = await storage.find('handlers');

    expect(concepts.length).toBeGreaterThan(0);
    expect(files.length).toBeGreaterThan(0);
    expect(symbols.length).toBeGreaterThan(0);
    expect(handlers.length).toBeGreaterThan(0);
  }, 120000);
});
