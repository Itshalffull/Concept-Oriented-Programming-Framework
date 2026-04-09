// generated/tests/themes-list.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\themes-list.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: themes-list', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "themes-list-dataSource", {"name":"themes-list-dataSource","kind":"concept-action","config":"{\"concept\":\"Theme\",\"action\":\"list\"}"});
    await storage.put("presentation", "themes-list-presentation", {"name":"themes-list-presentation","displayType":"card-grid","hints":"{}"});
    await storage.put("filter", "themes-list-filter", {"name":"themes-list-filter","node":"{\"type\":\"true\"}"});
    await storage.put("sort", "themes-list-sort", {"name":"themes-list-sort","keys":"[{\"field\":\"name\",\"direction\":\"asc\"}]"});
    await storage.put("projection", "themes-list-projection", {"name":"themes-list-projection","fields":"[]"});
    await storage.put('view', "themes-list", {"name":"themes-list","title":"themes-list","description":"","dataSource":"themes-list-dataSource","filter":"themes-list-filter","sort":"themes-list-sort","group":"","projection":"themes-list-projection","presentation":"themes-list-presentation","interaction":"","features":"[\"filter\",\"sort\",\"projection\"]","pagination":""});
    analysis = await compileAndAnalyze("themes-list", storage);
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
