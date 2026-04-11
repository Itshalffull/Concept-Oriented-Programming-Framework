// generated/tests/research-projects.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\research-projects.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: research-projects', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "research-projects-dataSource", {"name":"research-projects-dataSource","kind":"concept-action","config":"{\"concept\":\"ContentNode\",\"action\":\"list\"}"});
    await storage.put("presentation", "research-projects-presentation", {"name":"research-projects-presentation","displayType":"card-grid","hints":"{}"});
    await storage.put("filter", "research-projects-filter", {"name":"research-projects-filter","node":"{\"type\":\"true\"}"});
    await storage.put("sort", "research-projects-sort", {"name":"research-projects-sort","keys":"[]"});
    await storage.put("projection", "research-projects-projection", {"name":"research-projects-projection","fields":"[]"});
    await storage.put("interaction", "research-projects-interaction", {"name":"research-projects-interaction","rowActions":"[{\"key\":\"open\",\"concept\":\"ContentNode\",\"action\":\"get\",\"label\":\"Open\"}]"});
    await storage.put('view', "research-projects", {"name":"research-projects","title":"research-projects","description":"","dataSource":"research-projects-dataSource","filter":"research-projects-filter","sort":"research-projects-sort","group":"","projection":"research-projects-projection","presentation":"research-projects-presentation","interaction":"research-projects-interaction","features":"[\"filter\",\"sort\",\"projection\",\"interaction\"]","pagination":""});
    analysis = await compileAndAnalyze("research-projects", storage);
  });

  describe('invariants', () => {
  it("always: purity is read-write", () => {
    expect(analysis.purity).toBe("read-write");
  });
  });
});
