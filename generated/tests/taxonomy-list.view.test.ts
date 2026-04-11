// generated/tests/taxonomy-list.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\taxonomy-list.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: taxonomy-list', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "taxonomy-list-dataSource", {"name":"taxonomy-list-dataSource","kind":"concept-action","config":"{\"concept\":\"Taxonomy\",\"action\":\"list\"}"});
    await storage.put("presentation", "taxonomy-list-presentation", {"name":"taxonomy-list-presentation","displayType":"table","hints":"{}"});
    await storage.put("filter", "taxonomy-list-filter", {"name":"taxonomy-list-filter","node":"{\"type\":\"true\"}"});
    await storage.put("sort", "taxonomy-list-sort", {"name":"taxonomy-list-sort","keys":"[{\"field\":\"name\",\"direction\":\"asc\"}]"});
    await storage.put("projection", "taxonomy-list-projection", {"name":"taxonomy-list-projection","fields":"[]"});
    await storage.put('view', "taxonomy-list", {"name":"taxonomy-list","title":"taxonomy-list","description":"","dataSource":"taxonomy-list-dataSource","filter":"taxonomy-list-filter","sort":"taxonomy-list-sort","group":"","projection":"taxonomy-list-projection","presentation":"taxonomy-list-presentation","interaction":"","features":"[\"filter\",\"sort\",\"projection\"]","pagination":""});
    analysis = await compileAndAnalyze("taxonomy-list", storage);
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
