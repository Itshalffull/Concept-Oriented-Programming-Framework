// generated/tests/similar-entities.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\similar-entities.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: similar-entities', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "similar-entities-dataSource", {"name":"similar-entities-dataSource","kind":"concept-action","config":"{\"concept\":\"ContentNode\",\"action\":\"list\"}"});
    await storage.put("presentation", "similar-entities-presentation", {"name":"similar-entities-presentation","displayType":"card-grid","hints":"{}"});
    await storage.put("sort", "similar-entities-sort", {"name":"similar-entities-sort","keys":"[]"});
    await storage.put("projection", "similar-entities-projection", {"name":"similar-entities-projection","fields":"[]"});
    await storage.put('view', "similar-entities", {"name":"similar-entities","title":"similar-entities","description":"","dataSource":"similar-entities-dataSource","filter":"","sort":"similar-entities-sort","group":"","projection":"similar-entities-projection","presentation":"similar-entities-presentation","interaction":"","features":"[\"sort\",\"projection\"]","pagination":""});
    analysis = await compileAndAnalyze("similar-entities", storage);
  });

  describe('invariants', () => {
  it("always: purity is read-only", () => {
    expect(analysis.purity).toBe("read-only");
  });

  it("always: no invoke instructions", () => {
    expect(analysis.invokeCount).toBe(0);
  });
  });
});
