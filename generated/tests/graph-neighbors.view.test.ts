// generated/tests/graph-neighbors.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\graph-neighbors.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: graph-neighbors', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "graph-neighbors-dataSource", {"name":"graph-neighbors-dataSource","kind":"concept-action","config":"{\"concept\":\"ContentNode\",\"action\":\"list\"}"});
    await storage.put("presentation", "graph-neighbors-presentation", {"name":"graph-neighbors-presentation","displayType":"graph","hints":"{}"});
    await storage.put("projection", "graph-neighbors-projection", {"name":"graph-neighbors-projection","fields":"[{\"key\":\"node\",\"label\":\"Node\"},{\"key\":\"type\",\"label\":\"Type\"}]"});
    await storage.put('view', "graph-neighbors", {"name":"graph-neighbors","title":"graph-neighbors","description":"","dataSource":"graph-neighbors-dataSource","filter":"","sort":"","group":"","projection":"graph-neighbors-projection","presentation":"graph-neighbors-presentation","interaction":"","features":"[\"projection\"]","pagination":""});
    analysis = await compileAndAnalyze("graph-neighbors", storage);
  });

  describe('invariants', () => {
  it("always: purity is read-only", () => {
    expect(analysis.purity).toBe("read-only");
  });
  });
});
