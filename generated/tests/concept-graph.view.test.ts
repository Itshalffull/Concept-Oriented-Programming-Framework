// generated/tests/concept-graph.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\concept-graph.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: concept-graph', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "concept-graph-dataSource", {"name":"concept-graph-dataSource","kind":"concept-action","config":"{\"concept\":\"ContentNode\",\"action\":\"list\"}"});
    await storage.put("presentation", "concept-graph-presentation", {"name":"concept-graph-presentation","displayType":"canvas","hints":"{}"});
    await storage.put("projection", "concept-graph-projection", {"name":"concept-graph-projection","fields":"[{\"key\":\"node\",\"label\":\"Node\"},{\"key\":\"schemas\",\"label\":\"Schemas\"},{\"key\":\"content\",\"label\":\"Content\"}]"});
    await storage.put('view', "concept-graph", {"name":"concept-graph","title":"concept-graph","description":"","dataSource":"concept-graph-dataSource","filter":"","sort":"","group":"","projection":"concept-graph-projection","presentation":"concept-graph-presentation","interaction":"","features":"[\"projection\"]","pagination":""});
    analysis = await compileAndAnalyze("concept-graph", storage);
  });

  describe('invariants', () => {
  it("always: purity is read-only", () => {
    expect(analysis.purity).toBe("read-only");
  });
  });
});
