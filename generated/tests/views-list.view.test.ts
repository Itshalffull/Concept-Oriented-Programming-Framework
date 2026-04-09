// generated/tests/views-list.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\views-list.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: views-list', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "views-list-dataSource", {"name":"views-list-dataSource","kind":"concept-action","config":"{\"concept\":\"View\",\"action\":\"list\"}"});
    await storage.put("presentation", "views-list-presentation", {"name":"views-list-presentation","displayType":"table","hints":"{}"});
    await storage.put("filter", "views-list-filter", {"name":"views-list-filter","node":"{\"type\":\"true\"}"});
    await storage.put("sort", "views-list-sort", {"name":"views-list-sort","keys":"[{\"field\":\"name\",\"direction\":\"asc\"}]"});
    await storage.put("projection", "views-list-projection", {"name":"views-list-projection","fields":"[]"});
    await storage.put('view', "views-list", {"name":"views-list","title":"views-list","description":"","dataSource":"views-list-dataSource","filter":"views-list-filter","sort":"views-list-sort","group":"","projection":"views-list-projection","presentation":"views-list-presentation","interaction":"","features":"[\"filter\",\"sort\",\"projection\"]","pagination":""});
    analysis = await compileAndAnalyze("views-list", storage);
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
