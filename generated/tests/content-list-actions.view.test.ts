// generated/tests/content-list-actions.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\content-list-actions.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: content-list-actions', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "content-list-dataSource", {"name":"content-list-dataSource","kind":"concept-action","config":"{\"concept\":\"ContentNode\",\"action\":\"listBySchema\",\"params\":{\"schema\":\"Concept\"}}"});
    await storage.put("presentation", "content-list-presentation", {"name":"content-list-presentation","displayType":"table","hints":"{}"});
    await storage.put("filter", "content-list-filter", {"name":"content-list-filter","node":"{\"type\":\"eq\",\"field\":\"kind\",\"value\":\"concept\"}"});
    await storage.put("sort", "content-list-sort", {"name":"content-list-sort","keys":"[{\"field\":\"name\",\"direction\":\"asc\"}]"});
    await storage.put("projection", "content-list-projection", {"name":"content-list-projection","fields":"[{\"key\":\"node\",\"label\":\"Name\"},{\"key\":\"schemas\",\"label\":\"Schemas\"},{\"key\":\"createdBy\",\"label\":\"Created By\"},{\"key\":\"createdAt\",\"label\":\"Created\"}]"});
    await storage.put("interaction", "content-list-interaction", {"name":"content-list-interaction","rowActions":"[{\"key\":\"edit\",\"concept\":\"ContentNode\",\"action\":\"update\",\"label\":\"Edit\"}]"});
    await storage.put('view', "content-list", {"name":"content-list","title":"content-list","description":"","dataSource":"content-list-dataSource","filter":"content-list-filter","sort":"content-list-sort","group":"","projection":"content-list-projection","presentation":"content-list-presentation","interaction":"content-list-interaction","features":"[\"filter\",\"sort\",\"projection\",\"interaction\"]","pagination":""});
    analysis = await compileAndAnalyze("content-list", storage);
  });

  describe('invariants', () => {
  it("always: purity is read-write", () => {
    expect(analysis.purity).toBe("read-write");
  });

  it("always: invokes only ContentNode actions", () => {
    for (const ia of analysis.invokedActions) {
      expect(ia.startsWith("ContentNode/")).toBe(true);
    }
  });

  it("always: all invoke variants covered", () => {
    expect(analysis.uncoveredVariants).toEqual([]);
  });
  });
});
