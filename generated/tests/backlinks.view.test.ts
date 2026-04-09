// generated/tests/backlinks.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\backlinks.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: backlinks', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "backlinks-dataSource", {"name":"backlinks-dataSource","kind":"concept-action","config":"{\"concept\":\"ContentNode\",\"action\":\"list\",\"params\":{\"type\":\"backlink\"}}"});
    await storage.put("presentation", "backlinks-presentation", {"name":"backlinks-presentation","displayType":"table","hints":"{}"});
    await storage.put("sort", "backlinks-sort", {"name":"backlinks-sort","keys":"[]"});
    await storage.put("projection", "backlinks-projection", {"name":"backlinks-projection","fields":"[{\"key\":\"node\",\"label\":\"Source\"},{\"key\":\"type\",\"label\":\"Type\",\"formatter\":\"badge\"}]"});
    await storage.put('view', "backlinks", {"name":"backlinks","title":"backlinks","description":"","dataSource":"backlinks-dataSource","filter":"","sort":"backlinks-sort","group":"","projection":"backlinks-projection","presentation":"backlinks-presentation","interaction":"","features":"[\"sort\",\"projection\"]","pagination":""});
    analysis = await compileAndAnalyze("backlinks", storage);
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
