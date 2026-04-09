// generated/tests/workflows-list.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\workflows-list.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: workflows-list', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "workflows-list-dataSource", {"name":"workflows-list-dataSource","kind":"concept-action","config":"{\"concept\":\"Workflow\",\"action\":\"list\"}"});
    await storage.put("presentation", "workflows-list-presentation", {"name":"workflows-list-presentation","displayType":"table","hints":"{}"});
    await storage.put("filter", "workflows-list-filter", {"name":"workflows-list-filter","node":"{\"type\":\"true\"}"});
    await storage.put("sort", "workflows-list-sort", {"name":"workflows-list-sort","keys":"[]"});
    await storage.put("projection", "workflows-list-projection", {"name":"workflows-list-projection","fields":"[]"});
    await storage.put("interaction", "workflows-list-interaction", {"name":"workflows-list-interaction","rowActions":"[{\"key\":\"edit\",\"concept\":\"Workflow\",\"action\":\"update\",\"label\":\"Edit\"}]"});
    await storage.put('view', "workflows-list", {"name":"workflows-list","title":"workflows-list","description":"","dataSource":"workflows-list-dataSource","filter":"workflows-list-filter","sort":"workflows-list-sort","group":"","projection":"workflows-list-projection","presentation":"workflows-list-presentation","interaction":"workflows-list-interaction","features":"[\"filter\",\"sort\",\"projection\",\"interaction\"]","pagination":""});
    analysis = await compileAndAnalyze("workflows-list", storage);
  });

  describe('invariants', () => {
  it("always: purity is read-write", () => {
    expect(analysis.purity).toBe("read-write");
  });
  });
});
