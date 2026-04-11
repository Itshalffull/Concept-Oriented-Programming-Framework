// generated/tests/evidence-graph.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\evidence-graph.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: evidence-graph', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "evidence-graph-dataSource", {"name":"evidence-graph-dataSource","kind":"concept-action","config":"{\"concept\":\"ContentNode\",\"action\":\"list\",\"params\":{\"type\":\"evidence\"}}"});
    await storage.put("presentation", "evidence-graph-presentation", {"name":"evidence-graph-presentation","displayType":"graph","hints":"{}"});
    await storage.put("projection", "evidence-graph-projection", {"name":"evidence-graph-projection","fields":"[{\"key\":\"node\",\"label\":\"Node\"},{\"key\":\"type\",\"label\":\"Type\"},{\"key\":\"score\",\"label\":\"Score\"}]"});
    await storage.put('view', "evidence-graph", {"name":"evidence-graph","title":"evidence-graph","description":"","dataSource":"evidence-graph-dataSource","filter":"","sort":"","group":"","projection":"evidence-graph-projection","presentation":"evidence-graph-presentation","interaction":"","features":"[\"projection\"]","pagination":""});
    analysis = await compileAndAnalyze("evidence-graph", storage);
  });

  describe('invariants', () => {
  it("always: purity is read-only", () => {
    expect(analysis.purity).toBe("read-only");
  });
  });
});
